// Dosya kaydetme: iPhone ana ekran uygulamasında blob indirmesi güvenilir değil → önce Paylaş sayfası.

/** Dosyayı kaydet: Paylaş sayfası varsa (iPhone › Dosyalar'a kaydet) onu, yoksa indirme. */
export async function saveFile(file: File) {
  const name = file.name
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

