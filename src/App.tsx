import { useState, useEffect } from "react"
import { Home, PlusCircle, Library, Gamepad2, Settings as SettingsIcon, LogIn, LogOut, GraduationCap, Sparkles, Keyboard, Search } from "lucide-react"
import { TabHome } from "./components/TabHome"
import { TabAdd } from "./components/TabAdd"
import { TabAllCards } from "./components/TabAllCards"
import { TabGame } from "./components/TabGame"
import { TabLearn } from "./components/TabLearn"
import { TabSettings } from "./components/TabSettings"
import { TabTyping } from "./components/typing/TabTyping"
import { DictionaryModal } from "./components/DictionaryModal"
import { useFlashcardStore } from "./store"
import { useFirebaseSync } from "./useFirebaseSync"
import { useGitDataSync } from "./useGitDataSync"
import { loginWithGoogle, logout } from "./firebase"

type Tab = "home" | "typing" | "add" | "all" | "game" | "learn" | "settings"

const TAB_TO_PATH: Record<Tab, string> = {
  home: "home",
  typing: "typing",
  add: "add",
  all: "library",
  game: "game",
  learn: "learn",
  settings: "settings"
}

const PATH_TO_TAB: Record<string, Tab> = {
  home: "home",
  typing: "typing",
  add: "add",
  library: "all",
  game: "game",
  practice: "game",
  learn: "learn",
  settings: "settings"
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    let path = window.location.hash.replace("#/", "")
    if (!path) path = window.location.pathname.split("/").pop() || ""
    return PATH_TO_TAB[path] || "home"
  })
  const [isDictModalOpen, setIsDictModalOpen] = useState(false)

  const { settings } = useFlashcardStore()
  const { user, isLoading } = useFirebaseSync()
  useGitDataSync()

  const changeTab = (tab: Tab) => {
    setActiveTab(tab)
    window.history.pushState(null, "", `#/${TAB_TO_PATH[tab]}`)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsDictModalOpen(prev => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      let path = window.location.hash.replace("#/", "")
      if (PATH_TO_TAB[path]) setActiveTab(PATH_TO_TAB[path])
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    if (settings.isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [settings.isDarkMode])

  useEffect(() => {
    if (settings.showScrollbar === false) {
      document.documentElement.classList.add("hide-scrollbar")
    } else {
      document.documentElement.classList.remove("hide-scrollbar")
    }
  }, [settings.showScrollbar])

  return (
    <div className={`min-h-screen flex flex-col overflow-x-clip transition-colors ${settings.isDarkMode ? "dark bg-gray-900 text-white" : "bg-gray-50"}`}>
      {/* Header */}
      <header className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-xs sticky top-0 z-50 transition-colors border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Logo / Brand — Clicking navigates to Home */}
            <button
              type="button"
              onClick={() => changeTab("home")}
              className="flex items-center gap-2 cursor-pointer transition-transform active:scale-95 focus:outline-none"
              title="Home"
            >
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-xs hover:shadow-md transition-shadow">
                <Sparkles size={19} />
              </div>
            </button>

            {/* Quick Dictionary Search Button */}
            <button
              type="button"
              onClick={() => setIsDictModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-700/60 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-xl text-xs sm:text-sm font-medium transition-all shadow-2xs hover:border-purple-300"
              title="Tra từ điển 160.000 từ siêu tốc (Phím tắt ⌘K)"
            >
              <Search size={15} className="text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Từ điển</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-gray-100/80 dark:bg-gray-900/60 p-1 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
            <button
              onClick={() => changeTab("home")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "home"
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Home size={16} strokeWidth={activeTab === "home" ? 2.5 : 2} />
              <span>Home</span>
            </button>

            <button
              onClick={() => changeTab("typing")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "typing"
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Keyboard size={16} strokeWidth={activeTab === "typing" ? 2.5 : 2} />
              <span>Typing</span>
            </button>

            <button
              onClick={() => changeTab("add")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "add"
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <PlusCircle size={16} strokeWidth={activeTab === "add" ? 2.5 : 2} />
              <span>Add</span>
            </button>

            <button
              onClick={() => changeTab("all")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Library size={16} strokeWidth={activeTab === "all" ? 2.5 : 2} />
              <span>Library</span>
            </button>

            <button
              onClick={() => changeTab("game")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "game"
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Gamepad2 size={16} strokeWidth={activeTab === "game" ? 2.5 : 2} />
              <span>Game</span>
            </button>

            <button
              onClick={() => changeTab("learn")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "learn"
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <GraduationCap size={16} strokeWidth={activeTab === "learn" ? 2.5 : 2} />
              <span>Learn</span>
            </button>

            <button
              onClick={() => changeTab("settings")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "settings"
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <SettingsIcon size={16} strokeWidth={activeTab === "settings" ? 2.5 : 2} />
              <span>Settings</span>
            </button>
          </nav>

          <div>
            {isLoading ? (
              <span className="text-sm text-gray-500">Loading...</span>
            ) : user ? (
              <button 
                onClick={() => {
                  if (window.confirm("Are you sure you want to log out?")) {
                    logout()
                  }
                }} 
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <img src={user.photoURL || ""} alt="avatar" className="w-6 h-6 rounded-full" />
                <LogOut size={16} />
              </button>
            ) : (
              <button onClick={loginWithGoogle} className="flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-full transition-colors font-medium shadow-sm">
                <LogIn size={16} /> Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 mb-20 md:mb-8">
        {activeTab === "home" && <TabHome />}
        {activeTab === "typing" && <TabTyping />}
        {activeTab === "add" && <TabAdd />}
        {activeTab === "all" && <TabAllCards />}
        {activeTab === "game" && <TabGame />}
        {activeTab === "learn" && <TabLearn />}
        {activeTab === "settings" && <TabSettings />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 pb-safe z-40 transition-colors">
        <div className="max-w-3xl mx-auto flex justify-around">
          <button
            onClick={() => changeTab("home")}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              activeTab === "home" ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <Home size={20} strokeWidth={activeTab === "home" ? 2.5 : 2} />
            <span className="text-[11px] font-medium">Home</span>
          </button>

          <button
            onClick={() => changeTab("typing")}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              activeTab === "typing" ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <Keyboard size={20} strokeWidth={activeTab === "typing" ? 2.5 : 2} />
            <span className="text-[11px] font-medium">Typing</span>
          </button>

          <button
            onClick={() => changeTab("add")}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              activeTab === "add" ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <PlusCircle size={20} strokeWidth={activeTab === "add" ? 2.5 : 2} />
            <span className="text-[11px] font-medium">Add</span>
          </button>
          
          <button
            onClick={() => changeTab("all")}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              activeTab === "all" ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <Library size={20} strokeWidth={activeTab === "all" ? 2.5 : 2} />
            <span className="text-[11px] font-medium">Library</span>
          </button>

          <button
            onClick={() => changeTab("game")}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              activeTab === "game" ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <Gamepad2 size={20} strokeWidth={activeTab === "game" ? 2.5 : 2} />
            <span className="text-[11px] font-medium">Game</span>
          </button>

          <button
            onClick={() => changeTab("learn")}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              activeTab === "learn" ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <GraduationCap size={20} strokeWidth={activeTab === "learn" ? 2.5 : 2} />
            <span className="text-[11px] font-medium">Learn</span>
          </button>

          <button
            onClick={() => changeTab("settings")}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              activeTab === "settings" ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <SettingsIcon size={20} strokeWidth={activeTab === "settings" ? 2.5 : 2} />
            <span className="text-[11px] font-medium">Settings</span>
          </button>
        </div>
      </nav>

      <DictionaryModal isOpen={isDictModalOpen} onClose={() => setIsDictModalOpen(false)} />
    </div>
  )
}

export default App
