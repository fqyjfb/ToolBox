import React from 'react';

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

const Home = React.lazy(() => import('../pages/Home'));
const QuickLaunch = React.lazy(() => import('../pages/QuickLaunch'));
const HotNewsPage = React.lazy(() => import('../pages/HotNewsPage'));
const NavPage = React.lazy(() => import('../pages/NavPage'));
const LoginPage = React.lazy(() => import('../pages/LoginPage'));
const Settings = React.lazy(() => import('../pages/Settings'));
const About = React.lazy(() => import('../pages/About'));
const ToolsPage = React.lazy(() => import('../pages/ToolsPage'));

const CountryCodePage = React.lazy(() => import('../pages/tools/country-code'));
const ExchangePage = React.lazy(() => import('../pages/tools/exchange'));
const TranslatePage = React.lazy(() => import('../pages/tools/translate'));
const CloudClipboardPage = React.lazy(() => import('../pages/tools/cloud-clipboard'));
const QuickReplyPage = React.lazy(() => import('../pages/tools/quick-reply'));
const TodoManagerPage = React.lazy(() => import('../pages/tools/todo'));
const AccountManagerPage = React.lazy(() => import('../pages/tools/account'));
const MarkdownToWechatPage = React.lazy(() => import('../pages/tools/markdown-to-wechat'));
const IPInfoPage = React.lazy(() => import('../pages/tools/ip-info'));
const EmojiRemoverPage = React.lazy(() => import('../pages/tools/emoji-remover'));
const JsonFormatterPage = React.lazy(() => import('../pages/tools/json-formatter'));
const TimestampConverterPage = React.lazy(() => import('../pages/tools/timestamp-converter'));
const CaseConverterPage = React.lazy(() => import('../pages/tools/case-converter'));
const HashGeneratorPage = React.lazy(() => import('../pages/tools/hash-generator'));
const TextDeduplicatorPage = React.lazy(() => import('../pages/tools/text-deduplicator'));
const CsvToJsonPage = React.lazy(() => import('../pages/tools/csv-to-json'));
const JsonToCsvPage = React.lazy(() => import('../pages/tools/json-to-csv'));
const UrlParserPage = React.lazy(() => import('../pages/tools/url-parser'));
const SitemapGeneratorPage = React.lazy(() => import('../pages/tools/sitemap-generator'));
const QrGeneratorPage = React.lazy(() => import('../pages/tools/qr-generator'));
const RegexTesterPage = React.lazy(() => import('../pages/tools/regex-tester'));
const UrlEncodePage = React.lazy(() => import('../pages/tools/url-encode'));
const MetaTagsGeneratorPage = React.lazy(() => import('../pages/tools/meta-tags-generator'));
const MarkdownToTextPage = React.lazy(() => import('../pages/tools/markdown-to-text'));
const HtmlToTextPage = React.lazy(() => import('../pages/tools/html-to-text'));
const SqlMinifierPage = React.lazy(() => import('../pages/tools/sql-minifier'));
const HexEncodePage = React.lazy(() => import('../pages/tools/hex-encode'));
const HexDecodePage = React.lazy(() => import('../pages/tools/hex-decode'));
const WeatherPage = React.lazy(() => import('../pages/tools/weather'));

const AdminDashboardPage = React.lazy(() => import('../pages/admin'));
const AdminWebsitesPage = React.lazy(() => import('../pages/admin/websites'));
const AdminUsersPage = React.lazy(() => import('../pages/admin/users'));
const AdminUserEditPage = React.lazy(() => import('../pages/admin/user-edit'));
const AdminToolsPage = React.lazy(() => import('../pages/admin/tools'));
const AdminDatabasePage = React.lazy(() => import('../pages/admin/database'));

export const publicRoutes: RouteConfig[] = [
  { path: '/', element: <Home /> },
  { path: '/launch', element: <QuickLaunch /> },
  { path: '/news', element: <HotNewsPage /> },
  { path: '/nav', element: <NavPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/settings', element: <Settings /> },
  { path: '/about', element: <About /> },
  { path: '/tools/weather', element: <WeatherPage /> },
];

export const protectedRoutes: RouteConfig[] = [
  { path: '/tools', element: <ToolsPage />, requiresAuth: true },
  { path: '/tools/exchange', element: <ExchangePage />, requiresAuth: true },
  { path: '/tools/translate', element: <TranslatePage />, requiresAuth: true },
  { path: '/tools/cloud-clipboard', element: <CloudClipboardPage />, requiresAuth: true },
  { path: '/tools/quick-reply', element: <QuickReplyPage />, requiresAuth: true },
  { path: '/tools/todo', element: <TodoManagerPage />, requiresAuth: true },
  { path: '/tools/account', element: <AccountManagerPage />, requiresAuth: true },
  { path: '/tools/country-code', element: <CountryCodePage />, requiresAuth: true },
  { path: '/tools/markdown-to-wechat', element: <MarkdownToWechatPage />, requiresAuth: true },
  { path: '/tools/ip-info', element: <IPInfoPage />, requiresAuth: true },
  { path: '/tools/emoji-remover', element: <EmojiRemoverPage />, requiresAuth: true },
  { path: '/tools/json-formatter', element: <JsonFormatterPage />, requiresAuth: true },
  { path: '/tools/timestamp-converter', element: <TimestampConverterPage />, requiresAuth: true },
  { path: '/tools/case-converter', element: <CaseConverterPage />, requiresAuth: true },
  { path: '/tools/hash-generator', element: <HashGeneratorPage />, requiresAuth: true },
  { path: '/tools/text-deduplicator', element: <TextDeduplicatorPage />, requiresAuth: true },
  { path: '/tools/csv-to-json', element: <CsvToJsonPage />, requiresAuth: true },
  { path: '/tools/json-to-csv', element: <JsonToCsvPage />, requiresAuth: true },
  { path: '/tools/url-parser', element: <UrlParserPage />, requiresAuth: true },
  { path: '/tools/sitemap-generator', element: <SitemapGeneratorPage />, requiresAuth: true },
  { path: '/tools/qr-generator', element: <QrGeneratorPage />, requiresAuth: true },
  { path: '/tools/regex-tester', element: <RegexTesterPage />, requiresAuth: true },
  { path: '/tools/url-encode', element: <UrlEncodePage />, requiresAuth: true },
  { path: '/tools/meta-tags-generator', element: <MetaTagsGeneratorPage />, requiresAuth: true },
  { path: '/tools/markdown-to-text', element: <MarkdownToTextPage />, requiresAuth: true },
  { path: '/tools/html-to-text', element: <HtmlToTextPage />, requiresAuth: true },
  { path: '/tools/sql-minifier', element: <SqlMinifierPage />, requiresAuth: true },
  { path: '/tools/hex-encode', element: <HexEncodePage />, requiresAuth: true },
  { path: '/tools/hex-decode', element: <HexDecodePage />, requiresAuth: true },
];

export const adminRoutes: RouteConfig[] = [
  { path: '/admin', element: <AdminDashboardPage />, requiresAdmin: true },
  { path: '/admin/websites', element: <AdminWebsitesPage />, requiresAdmin: true },
  { path: '/admin/users', element: <AdminUsersPage />, requiresAdmin: true },
  { path: '/admin/users/edit/:id', element: <AdminUserEditPage />, requiresAdmin: true },
  { path: '/admin/tools', element: <AdminToolsPage />, requiresAdmin: true },
  { path: '/admin/database', element: <AdminDatabasePage />, requiresAdmin: true },
];