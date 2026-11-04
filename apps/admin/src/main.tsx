import React, { useEffect, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Activity,
  LogOut,
  FileText,
  HardDrive,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  Search,
  Menu,
} from "lucide-react";

import { ApiClient, ApiError } from "@folio/api-client";
import "./style.css";
const RegistrationChart = lazy(() => import("./RegistrationChart"));
let accessToken: string | null = null;
const api = new ApiClient(
  import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  () => accessToken,
);
type AdminUser = {
  _id: string;
  name: string;
  email?: string;
  role: string;
  accountStatus: string;
  storageUsed: number;
  storageQuota: number;
};
type Stats = {
  users: number;
  newUsers: number;
  documents: number;
  storageBytes: number;
  subscriptions: number;
  failedUploads: number;
  revenue: null;
};
type Health = {
  database: string;
  pendingUploads: number;
  expiredUploads: number;
  uptimeSeconds: number;
};
type Sub = {
  _id: string;
  userId: string;
  plan: string;
  platform: string;
  status: string;
  expiryDate: string;
};
const bytes = (n: number) =>
  n >= 1073741824
    ? `${(n / 1073741824).toFixed(1)} GB`
    : `${(n / 1048576).toFixed(1)} MB`;
function App() {
  const [user, setUser] = useState<{ name: string } | null>(null),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Overview"),
    [stats, setStats] = useState<Stats | null>(null),
    [health, setHealth] = useState<Health | null>(null),
    [users, setUsers] = useState<AdminUser[]>([]),
    [subscriptions, setSubscriptions] = useState<Sub[]>([]),
    [activity, setActivity] = useState<{ _id: string; count: number }[]>([]),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [menu, setMenu] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reach the API.");
      if (e instanceof ApiError && e.status === 401) {
        accessToken = null;
        setUser(null);
      }
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    if (tab === "Overview") {
      const [s, h, a] = await Promise.all([
        api.request<Stats>("/admin/dashboard"),
        api.request<Health>("/admin/system-health"),
        api.request<{ registrations: { _id: string; count: number }[] }>(
          "/admin/analytics",
        ),
      ]);
      setStats(s);
      setHealth(h);
      setActivity(a.registrations);
    }
    if (tab === "People")
      setUsers(
        (
          await api.request<{ items: AdminUser[] }>(
            `/admin/users?limit=20&offset=${offset}&search=${encodeURIComponent(search)}`,
          )
        ).items,
      );
    if (tab === "Subscriptions")
      setSubscriptions(
        (
          await api.request<{ items: Sub[] }>(
            `/admin/subscriptions?limit=20&offset=${offset}`,
          )
        ).items,
      );
    if (tab === "System")
      setHealth(await api.request<Health>("/admin/system-health"));
  }
  useEffect(() => {
    if (user) void run(load);
  }, [user, tab, offset]);
  if (!user)
    return (
      <main className="login-shell">
        <section className="login-story">
          <div className="wordmark">
            folio<span>.</span>
          </div>
          <span className="eyebrow">THE SPACE BEHIND THE SCANS</span>
          <h1>
            A clearer view.
            <br />A lighter footprint.
          </h1>
          <p>
            Keep your document platform running smoothly, with privacy at the
            center of every decision.
          </p>
          <div className="privacy-note">
            <ShieldCheck size={22} />
            <span>
              Document contents stay private.
              <br />
              Only operational metadata lives here.
            </span>
          </div>
        </section>
        <section className="login-panel">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const result = await api.post<{
                  accessToken: string;
                  user: { role: string; name: string };
                }>("/auth/login", { email, password });
                accessToken = result.accessToken;
                if (result.user.role !== "admin") {
                  await api.post("/auth/logout", {});
                  accessToken = null;
                  throw new Error(
                    "This account does not have administrator access.",
                  );
                }
                setUser(result.user);
                setPassword("");
              });
            }}
          >
            <div className="icon-box">
              <ShieldCheck />
            </div>
            <h2>Welcome back</h2>
            <p>Sign in to your administration workspace.</p>
            <label>
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to Folio"}
              <ArrowUpRight size={18} />
            </button>
            <small>
              Admin access is granted by your deployment operator. Sessions
              expire after 15 minutes.
            </small>
          </form>
        </section>
      </main>
    );
  const navigation = [
    { title: "Overview", icon: LayoutDashboard },
    { title: "People", icon: Users },
    { title: "Subscriptions", icon: CreditCard },
    { title: "System", icon: Activity },
  ];
  return (
    <div className="shell">
      <aside className={menu ? "open" : ""}>
        <div className="wordmark">
          folio<span>.</span>
        </div>
        <div className="workspace-label">ADMIN WORKSPACE</div>
        <nav>
          {navigation.map(({ title, icon: Icon }) => (
            <button
              key={title}
              className={tab === title ? "active" : ""}
              onClick={() => {
                setTab(title);
                setOffset(0);
                setMenu(false);
              }}
            >
              <Icon size={19} />
              {title}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="private-card">
            <ShieldCheck size={21} />
            <strong>Privacy comes first</strong>
            <p>This workspace never displays the contents of a scan.</p>
          </div>
          <button
            className="logout"
            onClick={() =>
              void run(async () => {
                await api.post("/auth/logout", {});
                accessToken = null;
                setUser(null);
              })
            }
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header>
          <button
            className="menu"
            aria-label="Toggle menu"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{tab}</strong>
          </div>
          <div className="header-right">
            <span className="live-dot" />
            Connected API
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>
        <main className="dashboard">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR PLATFORM, AT A GLANCE</span>
              <h1>
                {tab === "Overview"
                  ? "Good to see you, " + user.name.split(" ")[0] + "."
                  : tab}
              </h1>
              <p>
                {tab === "Overview"
                  ? "A little clarity on how things are running."
                  : tab === "People"
                    ? "Manage account access and storage, without opening private files."
                    : tab === "Subscriptions"
                      ? "Verified store entitlements and their current status."
                      : "A live look at your services and transfer queue."}
              </p>
            </div>
            <button
              className="outline"
              disabled={busy}
              onClick={() => void run(load)}
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} />
              Refresh
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {busy && (
            <div className="loading" role="status">
              Loading live platform data…
            </div>
          )}
          {tab === "Overview" && stats && (
            <>
              <section className="metrics">
                {[
                  {
                    title: "Total people",
                    value: stats.users.toLocaleString(),
                    note: `${stats.newUsers} joined in the last 30 days`,
                    icon: Users,
                  },
                  {
                    title: "Cloud documents",
                    value: stats.documents.toLocaleString(),
                    note: "Active documents across all accounts",
                    icon: FileText,
                  },
                  {
                    title: "Storage in use",
                    value: bytes(stats.storageBytes),
                    note: "Verified, completed uploads",
                    icon: HardDrive,
                  },
                  {
                    title: "Premium members",
                    value: stats.subscriptions.toLocaleString(),
                    note: "Active, server-verified subscriptions",
                    icon: CreditCard,
                  },
                ].map(({ title, value, note, icon: Icon }) => (
                  <article className="metric" key={title}>
                    <div className="metric-top">
                      <span>{title}</span>
                      <Icon size={19} />
                    </div>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </article>
                ))}
              </section>
              <section className="overview-grid">
                <article className="panel chart-panel">
                  <div className="panel-title">
                    <div>
                      <h2>A growing community</h2>
                      <p>New registrations over the past 30 days</p>
                    </div>
                    <span className="pill">Last 30 days</span>
                  </div>
                  {activity.length ? (
                    <Suspense
                      fallback={
                        <div className="empty" role="status">
                          Loading chart…
                        </div>
                      }
                    >
                      <RegistrationChart activity={activity} />
                    </Suspense>
                  ) : (
                    <div className="empty">
                      <Users size={34} />
                      <h3>Room to grow</h3>
                      <p>No new registrations in this period.</p>
                    </div>
                  )}
                </article>
                <article className="panel health-panel">
                  <div className="panel-title">
                    <h2>Service pulse</h2>
                    <span className="status">LIVE</span>
                  </div>
                  <div className="health-hero">
                    <Activity size={32} />
                    <h3>
                      {health?.database === "connected"
                        ? "Database connected"
                        : "Needs attention"}
                    </h3>
                    <p>Checked when this view was refreshed</p>
                  </div>
                  <div className="health-row">
                    <span>Pending uploads</span>
                    <strong>{health?.pendingUploads ?? "—"}</strong>
                  </div>
                  <div className="health-row">
                    <span>Expired uploads</span>
                    <strong>{health?.expiredUploads ?? "—"}</strong>
                  </div>
                  <div className="health-row">
                    <span>Aborted uploads</span>
                    <strong>{stats.failedUploads}</strong>
                  </div>
                </article>
              </section>
              <section className="privacy-banner">
                <div className="icon-box">
                  <ShieldCheck />
                </div>
                <div>
                  <h3>Useful insights. Private documents.</h3>
                  <p>
                    Analytics use account and transfer metadata. Document names,
                    images, and recognized text are never shown here.
                  </p>
                </div>
              </section>
            </>
          )}
          {tab === "People" && (
            <article className="panel">
              <form
                className="search-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  setOffset(0);
                  void run(load);
                }}
              >
                <Search size={18} />
                <input
                  aria-label="Search users by email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email address"
                />
                <button className="outline" disabled={busy}>
                  Search
                </button>
              </form>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Access</th>
                      <th>Storage</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id}>
                        <td>
                          <strong>{u.name}</strong>
                          <small>{u.email ?? "Phone account"}</small>
                        </td>
                        <td>{u.role}</td>
                        <td>
                          {bytes(u.storageUsed)} / {bytes(u.storageQuota)}
                        </td>
                        <td>
                          <span className="pill">{u.accountStatus}</span>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${u.accountStatus === "active" ? "Suspend" : "Reactivate"} this account?`,
                                )
                              )
                                void run(async () => {
                                  await api.patch(`/admin/users/${u._id}`, {
                                    accountStatus:
                                      u.accountStatus === "active"
                                        ? "suspended"
                                        : "active",
                                  });
                                  await load();
                                });
                            }}
                          >
                            {u.accountStatus === "active"
                              ? "Suspend"
                              : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!users.length && (
                  <div className="empty">No matching accounts.</div>
                )}
              </div>
              <div className="pagination">
                <button
                  className="outline"
                  disabled={!offset || busy}
                  onClick={() => setOffset(Math.max(0, offset - 20))}
                >
                  Previous
                </button>
                <span>Page {offset / 20 + 1}</span>
                <button
                  className="outline"
                  disabled={users.length < 20 || busy}
                  onClick={() => setOffset(offset + 20)}
                >
                  Next
                </button>
              </div>
            </article>
          )}
          {tab === "Subscriptions" && (
            <article className="panel">
              <div className="panel-title">
                <h2>Store entitlements</h2>
                <span className="pill">Revenue not collected</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Plan</th>
                      <th>Store</th>
                      <th>Status</th>
                      <th>Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => (
                      <tr key={s._id}>
                        <td>{s.userId}</td>
                        <td>{s.plan}</td>
                        <td>{s.platform}</td>
                        <td>{s.status}</td>
                        <td>{new Date(s.expiryDate).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!subscriptions.length && (
                  <div className="empty">
                    <CreditCard />
                    <h3>No subscriptions yet</h3>
                    <p>Verified purchases will appear here.</p>
                  </div>
                )}
              </div>
              <div className="pagination">
                <button
                  className="outline"
                  disabled={!offset || busy}
                  onClick={() => setOffset(Math.max(0, offset - 20))}
                >
                  Previous
                </button>
                <button
                  className="outline"
                  disabled={subscriptions.length < 20 || busy}
                  onClick={() => setOffset(offset + 20)}
                >
                  Next
                </button>
              </div>
            </article>
          )}
          {tab === "System" && health && (
            <section className="metrics">
              {Object.entries(health).map(([k, v]) => (
                <article className="metric" key={k}>
                  <span>{k.replace(/([A-Z])/g, " $1")}</span>
                  <strong>{v}</strong>
                </article>
              ))}
            </section>
          )}
          <footer>
            Folio administration{" "}
            <span>Thoughtfully organized. Private by design.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
