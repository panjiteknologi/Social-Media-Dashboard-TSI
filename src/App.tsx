import { useCallback, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PUBLISHED_WINDOWS } from '../shared/content';
import { AuthGate } from './components/AuthGate';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ARTICLE_TABS, NAV_ITEMS } from './data/editorial';
import { SOCIAL_TABS } from './data/growth';
import { REPORT_PERIODS } from './data/workflow';
import { CHART_RANGES } from './lib/chart';
import { SCREEN_PATHS } from './lib/routes';
import { useUrlEnum, useUrlId, useUrlKey } from './lib/urlState';
import { Analytics } from './screens/Analytics';
import { Approval } from './screens/Approval';
import { Articles } from './screens/Articles';
import { Dashboard } from './screens/Dashboard';
import { Placeholder } from './screens/Placeholder';
import { PLANNER_VIEW_KEYS, Planner } from './screens/Planner';
import { Reports } from './screens/Reports';
import { Seo } from './screens/Seo';
import { Settings } from './screens/Settings';
import { Social } from './screens/Social';

/**
 * Each route owns the URL state its screen needs, so a link carries the whole
 * view: which screen, which range, which record is open.
 */

function DashboardRoute() {
  const [range, setRange] = useUrlEnum('range', CHART_RANGES, '90D');
  return <Dashboard chartRange={range} onChartRangeChange={setRange} />;
}

function PlannerRoute() {
  const [view, setView] = useUrlEnum('view', PLANNER_VIEW_KEYS, 'kanban');
  return <Planner view={view} onViewChange={setView} />;
}

function ArticlesRoute() {
  // Articles are addressed by slug rather than row index, so a shared link
  // survives the list being re-sorted or re-filtered.
  const [slug, setSlug] = useUrlKey('article');
  const [tab, setTab] = useUrlEnum('tab', ARTICLE_TABS, 'Overview');
  const [published, setPublished] = useUrlEnum('published', PUBLISHED_WINDOWS, 'All');
  return (
    <Articles
      selectedSlug={slug}
      onSelect={setSlug}
      tab={tab}
      onTabChange={setTab}
      publishedWindow={published}
      onPublishedWindowChange={setPublished}
    />
  );
}

function SocialRoute() {
  const [tab, setTab] = useUrlEnum('platform', SOCIAL_TABS, 'All');
  return <Social tab={tab} onTabChange={setTab} />;
}

function SeoRoute() {
  const [range, setRange] = useUrlEnum('range', CHART_RANGES, '90D');
  return <Seo chartRange={range} onChartRangeChange={setRange} />;
}

function ApprovalRoute() {
  const [id, setId] = useUrlId('id', 1);
  return <Approval selectedId={id} onSelect={setId} />;
}

function ReportsRoute() {
  const [period, setPeriod] = useUrlEnum('period', REPORT_PERIODS, 'Weekly');
  return <Reports period={period} onPeriodChange={setPeriod} />;
}

/** Screens still to be built; the nav label names which one. */
function PlaceholderRoute({ label }: { label: string }) {
  return <Placeholder label={label} />;
}

function Shell() {
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const { pathname } = useLocation();

  const closeQuickCreate = useCallback(() => setQuickCreateOpen(false), []);

  return (
    <div className="app">
      <Sidebar onNavigate={closeQuickCreate} />

      <div className="main">
        <TopBar
          quickCreateOpen={quickCreateOpen}
          onToggleQuickCreate={() => setQuickCreateOpen((open) => !open)}
          onCloseQuickCreate={closeQuickCreate}
        />

        <main className="screen-body" key={pathname}>
          <Routes>
            <Route path={SCREEN_PATHS.dashboard} element={<DashboardRoute />} />
            <Route path={SCREEN_PATHS.planner} element={<PlannerRoute />} />
            <Route path={SCREEN_PATHS.articles} element={<ArticlesRoute />} />
            <Route path={SCREEN_PATHS.social} element={<SocialRoute />} />
            <Route path={SCREEN_PATHS.seo} element={<SeoRoute />} />
            <Route path={SCREEN_PATHS.analytics} element={<Analytics />} />
            <Route path={SCREEN_PATHS.approval} element={<ApprovalRoute />} />
            <Route path={SCREEN_PATHS.reports} element={<ReportsRoute />} />
            <Route path={SCREEN_PATHS.settings} element={<Settings />} />

            {NAV_ITEMS.filter((item) =>
              (['media', 'workflow'] as const).some((key) => key === item.key),
            ).map((item) => (
              <Route
                key={item.key}
                path={SCREEN_PATHS[item.key]}
                element={<PlaceholderRoute label={item.label} />}
              />
            ))}

            <Route path="*" element={<Navigate to={SCREEN_PATHS.dashboard} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  );
}
