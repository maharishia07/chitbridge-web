// src/pages/SettingsPage.jsx
import { Layout } from '../components/Layout';
import { AppModeSwitcher } from '../components/AppModeSwitcher';
import { FEATURES } from '../config/features';
import { DevBadge } from '../components/DevBadge';
import { useAppMode } from '../context/AppModeContext';

export default function SettingsPage() {
  const { showDevBadges } = useAppMode();

  return (
    <Layout title="Settings">
      <div className="p-4 flex flex-col gap-4 max-w-md">

        {showDevBadges && <DevBadge feature={FEATURES.app_mode_switch} />}

        {/* App mode switcher — always visible */}
        <AppModeSwitcher />

        {/* Entity settings — visual only until P1 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Business status
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <div className="text-sm text-gray-800">Open for business</div>
              <div className="text-xs text-gray-400">Customers can send chits</div>
            </div>
            <div className="w-11 h-6 bg-blue-600 rounded-full relative cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow"></div>
            </div>
          </div>

          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 mt-3">
            Assignment model
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <div className="text-sm text-gray-800">Pull model</div>
              <div className="text-xs text-gray-400">Actors self-assign from queue</div>
            </div>
            <div className="w-11 h-6 bg-blue-600 rounded-full relative cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow"></div>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <div className="text-sm text-gray-800">Push model</div>
              <div className="text-xs text-gray-400">Rules engine assigns automatically</div>
            </div>
            <div className="w-11 h-6 bg-gray-200 rounded-full relative cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow"></div>
            </div>
          </div>

          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 mt-3">
            Display options
          </div>
          {[
            { label: 'All task display', sub: 'Actors see full entity queue', on: true },
            { label: 'My task display', sub: 'Actors see own queue', on: true },
            { label: 'Delivery date display', sub: 'Show on chit cards', on: true },
            { label: 'Delivery address display', sub: 'Show on chit cards', on: true },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-none">
              <div>
                <div className="text-sm text-gray-800">{item.label}</div>
                <div className="text-xs text-gray-400">{item.sub}</div>
              </div>
              <div className={`w-11 h-6 ${item.on ? 'bg-blue-600' : 'bg-gray-200'} rounded-full relative cursor-pointer`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute ${item.on ? 'right-0.5' : 'left-0.5'} top-0.5 shadow`}></div>
              </div>
            </div>
          ))}

          {showDevBadges && (
            <DevBadge feature={FEATURES.entity_settings} />
          )}
        </div>

      </div>
    </Layout>
  );
}
