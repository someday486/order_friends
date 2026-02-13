"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { supabaseBrowser } from "@/lib/supabase/client";

type BrandSummary = {
  id: string;
  name: string;
  slug: string | null;
};

type BranchSummary = {
  id: string;
  name: string;
  slug: string | null;
  brandId: string;
};

type BranchWithContext = BranchSummary & {
  brandSlug: string | null;
  orderUrl: string;
};

type StoreGroup = BrandSummary & {
  branches: BranchWithContext[];
};

type NotificationSettingKey = "email" | "push" | "marketing" | "sound";

type NotificationSettings = {
  email: boolean;
  push: boolean;
  marketing: boolean;
  sound: boolean;
};

type ProfileState = {
  displayName: string;
  tagline: string;
  themeColor: string;
};

const SETTINGS_STORAGE_KEY = "customer:mypage:notification-settings";

function getDefaultSettings(): NotificationSettings {
  return {
    email: true,
    push: false,
    marketing: false,
    sound: false,
  };
}

function getOrderUrl(brandSlug: string | null, branchSlug: string | null, branchId: string): string {
  if (!brandSlug) {
    return `/order/branch/${branchId}`;
  }

  if (branchSlug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branchSlug)}`;
  }

  return `/order/${encodeURIComponent(brandSlug)}`;
}

function toTextInputValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default function CustomerMyPage() {
  const { user, signOut, refresh } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileState>({
    displayName: "",
    tagline: "",
    themeColor: "#3B82F6",
  });

  const [savingProfile, setSavingProfile] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    getDefaultSettings(),
  );

  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [sendPushLoading, setSendPushLoading] = useState(false);

  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);

  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isPushSupported =
    typeof window !== "undefined" && typeof Notification !== "undefined";

  useEffect(() => {
    if (isPushSupported) {
      setPushPermission(Notification.permission);
    }
  }, [isPushSupported]);

  useEffect(() => {
    const savedSettingsRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedSettingsRaw) {
      return;
    }

    try {
      const parsed = JSON.parse(savedSettingsRaw) as Partial<NotificationSettings>;
      setNotificationSettings((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore invalid localStorage values
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  useEffect(() => {
    const userMetadata = user?.user_metadata;
    if (!userMetadata || typeof userMetadata !== "object") {
      return;
    }

    const metadata = userMetadata as Record<string, unknown>;
    setProfile((prev) => ({
      ...prev,
      displayName:
        toTextInputValue(metadata.display_name) ||
        toTextInputValue(metadata.displayName) ||
        prev.displayName,
      tagline:
        toTextInputValue(metadata.profile_tagline) ||
        toTextInputValue(metadata.tagline) ||
        prev.tagline,
      themeColor:
        toTextInputValue(metadata.profile_theme_color) ||
        toTextInputValue(metadata.themeColor) ||
        prev.themeColor,
    }));
  }, [user?.user_metadata]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const brands = await apiClient.get<BrandSummary[]>("/customer/brands");

        const groups = await Promise.all(
          brands.map(async (brand) => {
            const branches = await apiClient
              .get<BranchSummary[]>(`/customer/branches?brandId=${encodeURIComponent(brand.id)}`)
              .catch(() => []);

            return {
              ...brand,
              branches: branches.map((branch) => ({
                ...branch,
                brandSlug: brand.slug,
                orderUrl: getOrderUrl(brand.slug, branch.slug, branch.id),
              })),
            };
          }),
        );

        setStoreGroups(groups);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Unable to load mypage data.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const updateNotificationSetting = (key: NotificationSettingKey, value: boolean) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: value }));
  };

  const requestPushPermission = async () => {
    if (!isPushSupported) {
      toast.error("This browser does not support browser notifications.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === "granted") {
        updateNotificationSetting("push", true);
        toast.success("Push permission approved.");
      } else if (permission === "denied") {
        updateNotificationSetting("push", false);
        toast.error("Push permission was denied.");
      }
    } catch {
      toast.error("Failed to request push permission.");
    }
  };

  const sendTestPush = async () => {
    if (!isPushSupported) {
      toast.error("This browser does not support browser notifications.");
      return;
    }

    if (pushPermission !== "granted") {
      toast.error("Allow push permission first.");
      return;
    }

    try {
      setSendPushLoading(true);
      new Notification("Push test", {
        body: "Test notification from My Page.",
      });
      toast.success("Test notification sent.");
    } catch {
      toast.error("Failed to send test notification.");
    } finally {
      setSendPushLoading(false);
    }
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSavingProfile(true);

      const { error: updateError } = await supabaseBrowser.auth.updateUser({
        data: {
          display_name: profile.displayName || null,
          profile_tagline: profile.tagline || null,
          profile_theme_color: profile.themeColor || null,
        },
      });

      if (updateError) {
        throw updateError;
      }

      await refresh();
      toast.success("Profile saved.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "delete") {
      toast.error("Type \"delete\" to confirm.");
      return;
    }

    try {
      setDeleting(true);
      await apiClient.delete("/customer/account");
      toast.success("Account deletion is complete.");
      await signOut();
    } catch {
      toast.error("Delete API is not prepared in this environment. Contact administrator.");
    } finally {
      setDeleting(false);
    }
  };

  const totalBranches = storeGroups.reduce((acc, group) => acc + group.branches.length, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold text-foreground">My Page</h1>
        <div className="card p-6 text-text-tertiary">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold text-foreground">My Page</h1>
        <div className="border border-danger-500 rounded-lg p-4 bg-danger-500/10 text-danger-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">My Page</h1>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-foreground">Profile Customize</h2>
          <Link href="/customer/order" target="_blank" className="text-sm text-text-secondary underline">
            Open Order Page
          </Link>
        </div>

        <div className="text-sm text-text-secondary mb-4">Account: {user?.email ?? "-"}</div>

        <form onSubmit={handleProfileSave} className="grid gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Display Name</label>
            <input
              value={profile.displayName}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, displayName: event.target.value }))
              }
              className="input-field"
              placeholder="Enter display name"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Tagline</label>
            <textarea
              value={profile.tagline}
              onChange={(event) => setProfile((prev) => ({ ...prev, tagline: event.target.value }))}
              className="input-field min-h-20"
              placeholder="Enter a short intro"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Theme Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={profile.themeColor}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, themeColor: event.target.value }))
                }
                className="h-10 w-14 rounded cursor-pointer"
              />
              <input
                value={profile.themeColor}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, themeColor: event.target.value }))
                }
                className="input-field"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          <button type="submit" disabled={savingProfile} className="btn-primary py-2.5 px-4 text-sm max-w-max">
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold text-foreground mb-4">Notification Settings</h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 py-2">
            <span>Email alerts</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={notificationSettings.email}
              onChange={(event) => updateNotificationSetting("email", event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 py-2">
            <span>Marketing alerts</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={notificationSettings.marketing}
              onChange={(event) => updateNotificationSetting("marketing", event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 py-2">
            <span>Alert sound</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={notificationSettings.sound}
              onChange={(event) => updateNotificationSetting("sound", event.target.checked)}
            />
          </label>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold text-foreground mb-4">Push Notification</h2>
        <div className="space-y-3 text-sm">
          <div className="text-text-secondary">Current status: {pushPermission}</div>
          <div className="flex flex-wrap gap-3">
            <button onClick={requestPushPermission} className="btn-primary px-4 py-2 text-sm">
              Request push permission
            </button>
            <button
              onClick={sendTestPush}
              disabled={sendPushLoading || pushPermission !== "granted"}
              className="px-4 py-2 rounded border border-border bg-transparent text-text-secondary text-sm disabled:opacity-60"
            >
              {sendPushLoading ? "Sending..." : "Send test push"}
            </button>
          </div>
          <label className="flex items-center justify-between gap-3 py-2 border-t border-border mt-2 pt-3">
            <span>Enable push alerts</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={notificationSettings.push}
              disabled={pushPermission !== "granted"}
              onChange={(event) => {
                if (pushPermission === "granted") {
                  updateNotificationSetting("push", event.target.checked);
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold text-foreground mb-4">Store List</h2>
        <div className="text-sm text-text-secondary mb-3">
          Total {storeGroups.length} brands · {totalBranches} stores
        </div>

        {storeGroups.length === 0 ? (
          <div className="text-text-tertiary">No linked brands or stores.</div>
        ) : (
          <div className="space-y-3">
            {storeGroups.map((group) => (
              <div key={group.id} className="border border-border rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <div className="font-semibold text-foreground">{group.name}</div>
                    <div className="text-xs text-text-tertiary">Brand slug: {group.slug || "-"}</div>
                  </div>
                  <Link
                    href={`/customer/brands/${group.id}`}
                    className="text-sm text-text-secondary underline"
                  >
                    Go to brand management
                  </Link>
                </div>

                {group.branches.length === 0 ? (
                  <div className="text-xs text-text-tertiary">No stores in this brand.</div>
                ) : (
                  <div className="space-y-2">
                    {group.branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="rounded border border-border/80 p-2 text-sm bg-bg-tertiary/40"
                      >
                        <div className="font-semibold text-foreground">{branch.name}</div>
                        <div className="text-xs text-text-tertiary mt-1">Store slug: {branch.slug || "-"}</div>
                        <div className="text-xs text-text-secondary mt-1 break-all">
                          Order URL: {branch.orderUrl}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            href={branch.orderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline text-text-secondary"
                          >
                            Open order page
                          </Link>
                          <Link
                            href={`/customer/branches/${branch.id}`}
                            className="text-xs underline text-text-secondary"
                          >
                            Manage store
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold text-foreground mb-4">Account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={signOut}
            className="py-2.5 px-4 rounded border border-border text-text-secondary bg-transparent hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <div className="text-sm text-text-secondary mb-2">Close account</div>
          <p className="text-xs text-text-tertiary mb-3">
            Type <span className="font-semibold text-text-secondary">delete</span> and click the button.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              className="input-field max-w-[140px]"
              placeholder="delete"
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="py-2.5 px-4 rounded border border-danger-500 text-danger-500 text-sm cursor-pointer hover:bg-danger-500/10 transition-colors disabled:opacity-50"
            >
              {deleting ? "Processing..." : "Delete Account"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
