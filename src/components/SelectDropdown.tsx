import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface Option {
  label: string
  value: string
}

interface SelectDropdownProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  className?: string
  buttonClassName?: string
}

export function SelectDropdown({ value, onChange, options, className = '', buttonClassName = '' }: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleGlobalClick)
    return () => document.removeEventListener('mousedown', handleGlobalClick)
  }, [])

  const selectedOption = options.find(o => o.value === value)

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm transition-colors ${buttonClassName}`}
      >
        <span className="truncate mr-2 font-medium">{selectedOption?.label || value}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-max bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-64 animate-in fade-in slide-in-from-top-1">
          <div className="overflow-y-auto p-1.5 space-y-0.5">
            {options.map(opt => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between transition-colors ${
                    isSelected 
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="truncate mr-4">{opt.label}</span>
                  {isSelected && <Check size={16} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
