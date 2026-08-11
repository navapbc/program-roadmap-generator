import { NavLink, Route, Routes } from 'react-router-dom';
import ProjectListPage from './routes/ProjectListPage.js';
import ProjectPage from './routes/ProjectPage.js';
import ProjectSettingsPage from './routes/ProjectSettingsPage.js';
import SizingKeysPage from './routes/SizingKeysPage.js';
import SizingKeyEditorPage from './routes/SizingKeyEditorPage.js';
import TimelinePage from './routes/TimelinePage.js';
import CombinedTimelinePage from './routes/CombinedTimelinePage.js';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`;

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <span className="font-semibold text-slate-900">Program Roadmap Generator</span>
          <nav className="flex gap-1">
            <NavLink to="/" className={navLinkClass} end>
              Programs
            </NavLink>
            <NavLink to="/sizing-keys" className={navLinkClass}>
              Sizing Keys
            </NavLink>
            <NavLink to="/combined-timeline" className={navLinkClass}>
              Combined Timeline
            </NavLink>
          </nav>
        </div>
      </header>
      {/* No max-width cap here — the Timeline/Combined Timeline routes need the
          full browser width to fit-to-width against (that's the whole point of
          "expand to full screen and the chart gets wider"). Every other route
          applies its own max-width on its own root element instead. */}
      <main className="flex-1 w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<ProjectListPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
          <Route path="/projects/:projectId/timeline" element={<TimelinePage />} />
          <Route path="/sizing-keys" element={<SizingKeysPage />} />
          <Route path="/sizing-keys/:sizingKeyId" element={<SizingKeyEditorPage />} />
          <Route path="/combined-timeline" element={<CombinedTimelinePage />} />
        </Routes>
      </main>
    </div>
  );
}
