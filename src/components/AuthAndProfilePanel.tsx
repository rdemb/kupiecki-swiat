import { gameRequest } from '../utils/gameServer';
import { imageUrl } from '../utils/imageUrl';
import React, { useState } from 'react';
import { COMMODITIES, CommodityId } from '../economy/economyEngine';
import { DuchyState, KnightState, RACES } from '../economy/gameData';
import {
  User,
  signInWithGooglePopup,
  signOutFirebaseUser,
} from '../firebase';

export interface TradeRecordItem {
  id: string;
  commodityId: CommodityId;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  cityId: string;
  timestamp: string;
}

interface AuthAndProfilePanelProps {
  backendUsername: string | null;
  playerDisplayName: string;
  playerTitle: string;
  selectedRaceId: string;
  playerGuildTag: string;
  playerGold: number;
  playerBondsGold: number;
  netWorth: number;
  tradesExecutedCount: number;
  profitableTradesCount: number;
  playerInventory: Record<CommodityId, number>;
  unlockedTechIds: string[];
  knight: KnightState;
  tradeHistory: TradeRecordItem[];
  firebaseUser: User | null;
  syncStatusMsg: string;
  onBackendAuthSuccess: (params: {
    token: string;
    profile: {
      uid: string;
      username: string;
      displayName: string;
      title: string;
      raceId: string;
      guildId: string;
      gold: number;
      bondsGold: number;
      netWorth: number;
      tradesExecutedCount: number;
      profitableTradesCount: number;
      inventory: Record<CommodityId, number>;
      unlockedTechIds: string[];
      knight?: KnightState;
      duchy?: DuchyState;
      tradeHistory?: TradeRecordItem[];
    };
  }) => void;
  onBackendLogout: () => void;
  onUpdateIdentity: (displayName: string, title: string, knightName: string) => void;
  onManualSyncToBackend: () => void;
  onOpenCinematicIntro: () => void;
}

export const AuthAndProfilePanel: React.FC<AuthAndProfilePanelProps> = ({
  backendUsername,
  playerDisplayName,
  playerTitle,
  selectedRaceId,
  playerGuildTag,
  playerGold,
  playerBondsGold,
  netWorth,
  tradesExecutedCount,
  profitableTradesCount,
  playerInventory,
  unlockedTechIds,
  knight,
  tradeHistory,
  firebaseUser,
  syncStatusMsg,
  onBackendAuthSuccess,
  onBackendLogout,
  onUpdateIdentity,
  onManualSyncToBackend,
  onOpenCinematicIntro,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [displayNameInput, setDisplayNameInput] = useState<string>(playerDisplayName);
  const [titleInput, setTitleInput] = useState<string>(playerTitle);
  const [knightNameInput, setKnightNameInput] = useState<string>(knight.name);
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const raceObj = RACES.find((r) => r.id === selectedRaceId) ?? RACES[0];

  const handleBackendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const bodyPayload =
        authMode === 'register'
          ? {
              username: usernameInput,
              password: passwordInput,
              displayName: displayNameInput || usernameInput,
              title: titleInput || 'Kupiec i Dowódca',
              raceId: selectedRaceId,
            }
          : {
              username: usernameInput,
              password: passwordInput,
            };

      const res = await gameRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Błąd autoryzacji z serwerem.');
      } else if (data.token && data.profile) {
        onBackendAuthSuccess({ token: data.token, profile: data.profile });
        setPasswordInput('');
      }
    } catch {
      setAuthError('Nie udało się połączyć z serwerem gry.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithGooglePopup();
    } catch {
      setAuthError('Logowanie Google zostało anulowane lub zablokowane w oknie przeglądarki.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-slate-100">
      {/* Left 4 Cols: Login / Registration & Cloud Sync */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3">
        {backendUsername ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-emerald-400">
                Zalogowano na Serwerze Kupieckim
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                @{backendUsername}
              </span>
            </div>

            <div className="bg-[#080b10] border border-emerald-500/40 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Konto Kupieckie:</span>
                <strong className="text-white">{playerDisplayName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status Bazy Danych:</span>
                <span className="text-emerald-400 font-semibold">{syncStatusMsg || 'Zapisano w bazie'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Chmura Firebase:</span>
                <span className="text-sky-400">
                  {firebaseUser ? firebaseUser.email : 'Konto lokalne serwera'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onManualSyncToBackend}
                className="min-h-[40px] py-2 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Zapisz Stan Konta
              </button>
              <button
                type="button"
                onClick={onBackendLogout}
                className="min-h-[40px] py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Wyloguj się
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBackendSubmit} className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-amber-400">
                Konto Gracza (Logowanie i Rejestracja)
              </span>
              <div className="flex items-center gap-1 bg-[#080b10] p-0.5 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError('');
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Rejestracja
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Logowanie
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="auth-username-input" className="block text-slate-400 mb-1">
                Login Kupiecki (3-32 znaki)
              </label>
              <input
                id="auth-username-input"
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="np. kupiec_roland"
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label htmlFor="auth-password-input" className="block text-slate-400 mb-1">
                Hasło (co najmniej 6 znaków)
              </label>
              <input
                id="auth-password-input"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••"
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {authMode === 'register' && (
              <div>
                <label htmlFor="auth-displayname-input" className="block text-slate-400 mb-1">
                  Imię Kupca w Rankingach i na Giełdzie
                </label>
                <input
                  id="auth-displayname-input"
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Lord Kupiecki"
                  className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            {authError && (
              <div role="alert" className="text-xs text-rose-400 bg-rose-950/60 border border-rose-800 rounded px-2.5 py-1.5">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="min-h-[42px] w-full py-2 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              {authLoading
                ? 'Przetwarzanie...'
                : authMode === 'register'
                  ? 'Utwórz Konto i Zapisz Profil'
                  : 'Zaloguj się do Konta'}
            </button>
          </form>
        )}

        {/* Firebase Google Cloud Option + Cinematic Trailer Trigger */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          {firebaseUser ? (
            <div className="flex items-center justify-between bg-[#080b10] border border-sky-500/40 rounded p-2 text-xs">
              <span className="truncate text-sky-300">
                Chmura Google: <strong>{firebaseUser.displayName || firebaseUser.email}</strong>
              </span>
              <button
                type="button"
                onClick={() => signOutFirebaseUser()}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
              >
                Rozłącz
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="min-h-[38px] w-full py-1.5 px-3 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              Połącz Profil z Kontem Google (Firebase Cloud)
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCinematicIntro}
            className="min-h-[38px] w-full py-1.5 px-3 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Odtwórz Film Wprowadzający (Cinematic)
          </button>
        </div>
      </div>

      {/* Center 4 Cols: Persistent Player & Knight Profile Card */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center gap-3 pb-2.5 border-b border-slate-800">
            <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-amber-500/70 bg-[#111722] shrink-0">
              <img
                src={imageUrl('avatar_merchant_lord_1795641278352.jpg')}
                alt="Portret Kupca"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-400">
                {playerGuildTag} · {raceObj.name.split(' ')[0]}
              </div>
              <h3 className="text-base font-bold text-white truncate">{playerDisplayName}</h3>
              <p className="text-xs text-slate-400 truncate">{playerTitle}</p>
            </div>
          </div>

          {/* Editable Identity Fields */}
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="prof-name-input" className="block text-[11px] text-slate-400 mb-0.5">
                  Imię Kupca
                </label>
                <input
                  id="prof-name-input"
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="w-full bg-[#111722] border border-slate-700 rounded px-2 py-1 text-white"
                />
              </div>
              <div>
                <label htmlFor="prof-knight-input" className="block text-[11px] text-slate-400 mb-0.5">
                  Imię Twojego Rycerza
                </label>
                <input
                  id="prof-knight-input"
                  type="text"
                  value={knightNameInput}
                  onChange={(e) => setKnightNameInput(e.target.value)}
                  className="w-full bg-[#111722] border border-slate-700 rounded px-2 py-1 text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onUpdateIdentity(displayNameInput, titleInput, knightNameInput)}
              className="py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Aktualizuj Dane Profilu i Rycerza
            </button>
          </div>

          {/* Financial & Combat Summary */}
          <div className="grid grid-cols-2 gap-2 font-mono-tabular text-xs">
            <div className="bg-[#080b10] border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400">Majątek Netto</div>
              <div className="text-sm font-bold text-amber-400">
                {netWorth.toLocaleString('pl-PL')} zł
              </div>
            </div>
            <div className="bg-[#080b10] border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400">Złoto / Lokaty Mennicy</div>
              <div className="text-sm font-bold text-white">
                {Math.round(playerGold)} / {Math.round(playerBondsGold)} zł
              </div>
            </div>
            <div className="bg-[#080b10] border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400">Poziom Rycerza</div>
              <div className="text-sm font-bold text-emerald-400">
                Poz. {knight.level} ({knight.monstersDefeated} zwycięstw)
              </div>
            </div>
            <div className="bg-[#080b10] border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400">Transakcje / Technologie</div>
              <div className="text-sm font-bold text-sky-400">
                {tradesExecutedCount} transakcji · {unlockedTechIds.length}/9 tech
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right 4 Cols: Player Warehouse Inventory & Trade Audit Log */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-amber-400 pb-1.5 border-b border-slate-800">
            Zawartość Spichlerza i Magazynu Kupieckiego
          </h4>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {COMMODITIES.map((c) => (
              <div
                key={c.id}
                className="bg-[#080b10] border border-slate-800/80 rounded px-2 py-1.5 flex items-center justify-between text-xs"
              >
                <span className="text-slate-300 truncate">{c.name}</span>
                <strong className="font-mono-tabular text-amber-400">
                  {playerInventory[c.id] ?? 0} szt.
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-300 pb-1 border-b border-slate-800">
            Ostatnie Transakcje w Księdze Kupieckiej ({tradeHistory.length})
          </h4>
          <div className="space-y-1 mt-1.5 max-h-28 overflow-y-auto pr-1 text-[11px] font-mono-tabular">
            {tradeHistory.length === 0 ? (
              <div className="text-slate-500 py-2">
                Brak zapisanych transakcji w bieżącej sesji.
              </div>
            ) : (
              tradeHistory.slice(0, 10).map((tr) => {
                const comm = COMMODITIES.find((c) => c.id === tr.commodityId);
                return (
                  <div
                    key={tr.id}
                    className="flex items-center justify-between bg-[#080b10] border border-slate-800/70 rounded px-2 py-1"
                  >
                    <span className={tr.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}>
                      {tr.side === 'buy' ? 'KUPNO' : 'SPRZEDAŻ'} {tr.quantity}x {comm?.symbol}
                    </span>
                    <span className="text-slate-300">
                      @{tr.price.toFixed(1)} zł · {tr.timestamp}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
