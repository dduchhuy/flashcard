import { useState, useEffect } from 'react'
import { PlusCircle, Library, Gamepad2, Settings as SettingsIcon, LogIn, LogOut } from 'lucide-react'
import { TabHome } from './components/TabHome'
import { TabAllCards } from './components/TabAllCards'
import { TabGame } from './components/TabGame'
import { TabSettings } from './components/TabSettings'
import { useFlashcardStore } from './store'
import { useFirebaseSync } from './useFirebaseSync'
import { loginWithGoogle, logout } from './firebase'

type Tab = 'home' | 'all' | 'game' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const { settings } = useFlashcardStore()
  const { user, isLoading } = useFirebaseSync()

  useEffect(() => {
    if (settings.isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [settings.isDarkMode])

  return (
    <div className={`min-h-screen flex flex-col overflow-x-clip transition-colors ${settings.isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-30 transition-colors">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Flashcards</h1>
          </div>
          <div>
            {isLoading ? (
              <span className="text-sm text-gray-500">Đang tải...</span>
            ) : user ? (
              <button 
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
                    logout()
                  }
                }} 
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <img src={user.photoURL || ''} alt="avatar" className="w-6 h-6 rounded-full" />
                <LogOut size={16} />
              </button>
            ) : (
              <button onClick={loginWithGoogle} className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full transition-colors font-medium shadow-sm">
                <LogIn size={16} /> Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 mb-20">
        {activeTab === 'home' && <TabHome />}
        {activeTab === 'all' && <TabAllCards />}
        {activeTab === 'game' && <TabGame />}
        {activeTab === 'settings' && <TabSettings />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe z-40 transition-colors">
        <div className="max-w-3xl mx-auto flex justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
              activeTab === 'home' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <PlusCircle size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-xs font-medium">Add</span>
          </button>
          
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
              activeTab === 'all' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Library size={24} strokeWidth={activeTab === 'all' ? 2.5 : 2} />
            <span className="text-xs font-medium">Library</span>
          </button>

          <button
            onClick={() => setActiveTab('game')}
            className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
              activeTab === 'game' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Gamepad2 size={24} strokeWidth={activeTab === 'game' ? 2.5 : 2} />
            <span className="text-xs font-medium">Practice</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
              activeTab === 'settings' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <SettingsIcon size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

export default App
