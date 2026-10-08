import { useFlashcardStore } from './store'

export function extractWordsAndSpaces(sentence: string) {
  const parts = sentence.trim().split(/(\s+)/)
  const words: string[] = []
  const spaces: string[] = []
  let initialSpace = ""
  
  for (let i = 0; i < parts.length; i += 2) {
    let w = parts[i]
    let s = parts[i + 1] || ""

    if (/^[.,!?;:"'()[\]{}<>]+$/.test(w)) {
      words.push(w)
      spaces.push(s)
      continue
    }

    const matchLeading = w.match(/^([.,!?;:"'()[\]{}<>]+)(.*)$/)
    if (matchLeading) {
      if (words.length > 0) {
        spaces[spaces.length - 1] += matchLeading[1]
      } else {
        initialSpace += matchLeading[1]
      }
      w = matchLeading[2]
    }

    const matchTrailing = w.match(/^(.*?)([.,!?;:"'()[\]{}<>]+)$/)
    if (matchTrailing) {
      w = matchTrailing[1]
      s = matchTrailing[2] + s
    }

    words.push(w)
    spaces.push(s)
  }
  return { words, spaces, initialSpace }
}

export function extractWordText(sentence: string, indices: number[]) {
  const { words, spaces } = extractWordsAndSpaces(sentence)
  let text = ''
  indices.forEach((idx, i) => {
    text += words[idx]
    if (i < indices.length - 1) text += spaces[idx]
  })
  return text
}

export function getBlankedSentence(sentence: string, indices: number[]) {
  const { words, spaces, initialSpace } = extractWordsAndSpaces(sentence)
  let text = initialSpace
  for(let i=0; i<words.length; i++) {
    if (indices.includes(i)) {
      text += "_________"
    } else {
      text += words[i]
    }
    if (i < words.length - 1) text += spaces[i]
  }
  return text
}

export function fuzzyMatch(input: string, target: string) {
  const clean1 = input.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")
  const clean2 = target.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")
  
  if (clean1 === clean2) return true
  if (clean1.length < 3 || clean2.length < 3) return false
  
  const matrix = Array(clean2.length + 1).fill(null).map(() => Array(clean1.length + 1).fill(null))
  for (let i = 0; i <= clean1.length; i += 1) { matrix[0][i] = i }
  for (let j = 0; j <= clean2.length; j += 1) { matrix[j][0] = j }
  for (let j = 1; j <= clean2.length; j += 1) {
    for (let i = 1; i <= clean1.length; i += 1) {
      const indicator = clean1[i - 1] === clean2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      )
    }
  }
  const distance = matrix[clean2.length][clean1.length]
  const maxDistance = clean2.length <= 5 ? 1 : 2
  return distance <= maxDistance
}

export function speakEnglish(text: string) {
  if (!('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const voices = window.speechSynthesis.getVoices()
  
  const settings = useFlashcardStore.getState().settings
  
  let targetAccent = settings.voiceAccent
  if (targetAccent === 'Random') {
    targetAccent = Math.random() > 0.5 ? 'US' : 'UK'
  }
  
  let targetGender = settings.voiceGender
  if (targetGender === 'Random') {
    targetGender = Math.random() > 0.5 ? 'Male' : 'Female'
  }

  const langPrefix = targetAccent === 'US' ? 'en-US' : 'en-GB'
  const langMatch = targetAccent === 'US' ? 'en_US' : 'en_GB'
  const matchingVoices = voices.filter(v => v.lang.startsWith(langPrefix) || v.lang === langMatch)

  let selectedVoice = null
  if (matchingVoices.length > 0) {
    const isMale = targetGender === 'Male'
    for (const v of matchingVoices) {
      const name = v.name.toLowerCase()
      if (isMale) {
        if ((name.includes('male') && !name.includes('female')) || name.includes('daniel') || name.includes('alex') || name.includes('fred') || name.includes('oliver') || name.includes('arthur')) { 
          selectedVoice = v; 
          break; 
        }
      } else {
        if (name.includes('female') || name.includes('samantha') || name.includes('serena') || name.includes('victoria') || name.includes('karen') || name.includes('moira') || name.includes('tessa') || name.includes('google us english')) { 
          selectedVoice = v; 
          break; 
        }
      }
    }
    if (!selectedVoice) selectedVoice = matchingVoices[0]
  }

  if (selectedVoice) {
    u.voice = selectedVoice
  } else {
    u.lang = langPrefix
  }

  u.rate = 0.9
  window.speechSynthesis.speak(u)
}
