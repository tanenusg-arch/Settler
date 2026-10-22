import React, { useState } from 'react';
import {
  Code2,
  ExternalLink,
  History,
  KeyRound,
  Menu,
  Plus,
  Send,
  ShieldCheck,
  Terminal,
  X,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavTab = 'verifier' | 'developer' | 'keys' | 'ledger';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenApiKeyModal: () => void;
  keyCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenApiKeyModal,
  keyCount = 0,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const { user, signIn, signOut } = useAuth();

  const handleSelectTab = (tab: NavTab) => {
    onTabChange(tab);
    setIsDrawerOpen(false);
  };

  const navItems = [
    {
      id: 'verifier' as NavTab,
      label: 'Payment Verifier',
      badge: 'Core',
      description: 'Scan and extract live payment receipts from CBE, Awash, and eBirr',
      icon: ShieldCheck,
    },
    {
      id: 'developer' as NavTab,
      label: 'API & Documentation',
      badge: 'POST /api/verify',
      description: 'REST API console, simple JavaScript helper, and live execution',
      icon: Code2,
    },
    {
      id: 'keys' as NavTab,
      label: 'API Keys',
      badge: keyCount > 0 ? `${keyCount} Active` : 'Self-Service',
      description: 'Generate secret keys with one-time reveal and auto-masking',
      icon: KeyRound,
    },
    {
      id: 'ledger' as NavTab,
      label: 'Audit Ledger',
      badge: 'Anti-Replay',
      description: 'Permanent log of all verified receipts and fraud attempts',
      icon: History,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-black/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSelectTab('verifier')}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black font-extrabold text-sm shadow-sm">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white font-sans">
                  SETTLR
                </span>
                <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 rounded hidden xs:inline-block">
                  Ethiopia
                </span>
              </div>
            </button>
          </div>

          {/* Center Tabs (Desktop quick switch) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === item.id
                    ? 'text-white font-semibold border-b-2 border-white'
                    : 'hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {item.id === 'keys' && keyCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300">
                    {keyCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right Action: Auth + Three-Line Menu (Hamburger) + Quick Action */}
          <div className="flex items-center gap-2.5">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-4 w-4 rounded-full" />
                  ) : (
                    <UserIcon className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                  <span className="text-white text-[11px] max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  title="Sign out of Firebase"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className="flex items-center gap-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="hidden sm:flex items-center gap-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:text-white transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Key</span>
            </button>

            {/* Three-Line Navigation Bar Toggle (≡) */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open Navigation Menu"
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-Over Drawer containing all navigation items */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Body */}
          <div className="relative z-10 w-full max-w-sm bg-neutral-950 border-l border-neutral-800 h-full flex flex-col p-6 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Top Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-white text-black font-bold">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">SETTLR Navigation</h3>
                  <span className="text-[10px] text-neutral-400 font-mono">Ethiopian Verification Suite</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Included Navigation Links */}
            <div className="flex-1 overflow-y-auto py-5 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-2 px-1">
                All Modules
              </span>

              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                      isActive
                        ? 'border-white bg-black text-white shadow-sm'
                        : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-800 hover:text-white hover:bg-black/40'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                        isActive
                          ? 'bg-white text-black'
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-neutral-200'}`}>
                          {item.label}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              {user ? (
                <div className="p-3 rounded-lg bg-black border border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-6 w-6 rounded-full shrink-0" />
                    ) : (
                      <UserIcon className="h-5 w-5 text-neutral-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{user.displayName || 'Developer'}</p>
                      <p className="text-[10px] text-neutral-400 font-mono truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setIsDrawerOpen(false);
                    }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800"
                    title="Sign Out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    signIn();
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In with Google</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenApiKeyModal();
                }}
                className="w-full py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Create New API Key</span>
              </button>

              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
                <span>Database: Firestore Cloud</span>
                <span className="text-white">Active</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
