# Bir klasördeki tüm MP3'leri Windows'un yerleşik dönüştürücüsüyle (Media Foundation) WAV'a çevirir.
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts\mp3-to-wav.ps1 -InDir girdi -OutDir cikti
param(
  [Parameter(Mandatory = $true)][string]$InDir,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Filter = "*.mp3"
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Transcoding.MediaTranscoder, Windows.Media.Transcoding, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media.MediaProperties, ContentType = WindowsRuntime]

$methods = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = ($methods | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskAction = ($methods | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
$asTaskProgress = ($methods | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' })[0]
function Await($op, [Type]$type) { $t = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
function AwaitProgress($op) { $t = $asTaskProgress.MakeGenericMethod([double]).Invoke($null, @($op)); $t.Wait(-1) | Out-Null }

New-Item -ItemType Directory -Force $OutDir | Out-Null
$outFolder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync((Resolve-Path $OutDir).Path)) ([Windows.Storage.StorageFolder])
$profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateWav([Windows.Media.MediaProperties.AudioEncodingQuality]::High)
# kanal/örnekleme: varsayılan (Node tarafında tek kanala indirilir)
$tc = New-Object Windows.Media.Transcoding.MediaTranscoder
$n = 0
foreach ($f in Get-ChildItem $InDir -Filter $Filter) {
  $src = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
  $dst = Await ($outFolder.CreateFileAsync($f.BaseName + '.wav', [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
  $prep = Await ($tc.PrepareFileTranscodeAsync($src, $dst, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
  if (-not $prep.CanTranscode) { throw "Donusturulemedi: $($f.Name) ($($prep.FailureReason))" }
  AwaitProgress ($prep.TranscodeAsync())
  $n++
}
Write-Host "$n dosya WAV'a cevrildi."
