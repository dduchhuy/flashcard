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
  
  let selectedVoice = null

  if (settings.isSpecialAccent && settings.specialAccent) {
    let langPrefix = ''
    if (settings.specialAccent === 'Indian') langPrefix = 'en-IN'
    if (settings.specialAccent === 'Irish') langPrefix = 'en-IE'
    if (settings.specialAccent === 'French') langPrefix = 'fr-FR'

    const specialVoices = voices.filter(v => v.lang.startsWith(langPrefix))
    
    // Sort to prioritize Google/Online voices
    specialVoices.sort((a, b) => {
      const scoreA = (a.name.includes('Online') || a.name.includes('Google')) ? 1 : 0
      const scoreB = (b.name.includes('Online') || b.name.includes('Google')) ? 1 : 0
      return scoreB - scoreA
    })

    if (specialVoices.length > 0) {
      selectedVoice = specialVoices[0]
    } else {
      // Fallback if the specific accent is not installed on the OS
      u.lang = langPrefix
    }
  } else {
    // Normal Accent/Gender Logic
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

    if (matchingVoices.length > 0) {
      const isMale = targetGender === 'Male'
      
      const maleNames = ['guy', 'christopher', 'eric', 'ryan', 'george', 'daniel', 'alex', 'david', 'arthur', 'william', 'male']
      const femaleNames = ['aria', 'jenny', 'ana', 'sonia', 'libby', 'mia', 'samantha', 'serena', 'victoria', 'karen', 'tessa', 'female', 'google us english', 'google uk english female']
      
      const sortedVoices = [...matchingVoices].sort((a, b) => {
        const scoreA = (a.name.includes('Online') || a.name.includes('Natural') || a.name.includes('Google')) ? 1 : 0
        const scoreB = (b.name.includes('Online') || b.name.includes('Natural') || b.name.includes('Google')) ? 1 : 0
        return scoreB - scoreA
      })

      const targetNames = isMale ? maleNames : femaleNames
      
      for (const v of sortedVoices) {
        const name = v.name.toLowerCase()
        if (isMale && name.includes('female')) continue
        if (!isMale && name.includes('male') && !name.includes('female')) continue
        
        if (targetNames.some(n => name.includes(n))) {
          selectedVoice = v
          break
        }
      }
      if (!selectedVoice) selectedVoice = sortedVoices[0]
    } else {
      u.lang = langPrefix
    }
  }

  if (selectedVoice) {
    u.voice = selectedVoice
  }

  u.rate = 0.9
  window.speechSynthesis.speak(u)
}
