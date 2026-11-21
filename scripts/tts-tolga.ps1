# Windows'un Türkçe sesi (Microsoft Tolga, OneCore) ile metinleri WAV'a çevirir.
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts\tts-tolga.ps1 -ListFile liste.tsv -OutDir public\voice
# liste.tsv satırı: <dosya-adı><TAB><okunacak metin>
param(
  [Parameter(Mandatory = $true)][string]$ListFile,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [double]$Rate = 1.08
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
function Await($op, [Type]$type) {
  $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $t.Wait(-1) | Out-Null
  $t.Result
}

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -eq 'tr-TR' } | Select-Object -First 1
if (-not $voice) { throw 'tr-TR sesi bulunamadı (Microsoft Tolga kurulu değil).' }
$synth.Voice = $voice
$synth.Options.SpeakingRate = $Rate
Write-Host "Ses: $($voice.DisplayName)"

New-Item -ItemType Directory -Force $OutDir | Out-Null
$lines = Get-Content -Encoding UTF8 $ListFile | Where-Object { $_ -match "`t" }
foreach ($line in $lines) {
  $name, $text = $line -split "`t", 2
  $stream = Await ($synth.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $size = [uint32]$stream.Size
  $null = Await ($reader.LoadAsync($size)) ([uint32])
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  [IO.File]::WriteAllBytes((Join-Path $OutDir "$name.wav"), $bytes)
  $reader.Dispose(); $stream.Dispose()
}
Write-Host "$($lines.Count) klip yazıldı."
