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

type NotificationSettingKey = "email" | "push" | "marketing" | "sound" | "kakao";

type NotificationSettings = {
  email: boolean;
  push: boolean;
  marketing: boolean;
  sound: boolean;
  kakao: boolean;
};

type ProfileState = {
  displayName: string;
  tagline: string;
  themeColor: string;
};

const SETTINGS_STORAGE_KEY = "customer:mypage:notification-settings";
const KAKAO_SETTINGS_STORAGE_KEY = "customer:mypage:kakao-notification-settings";
const DELETE_CONFIRM_TEXT = "탈퇴";
const KAKAO_TEST_MESSAGE = "테스트 메시지입니다. 카카오톡 알림이 정상적으로 발송되었습니다.";

function getDefaultSettings(): NotificationSettings {
  return {
    email: true,
    push: false,
    marketing: false,
    sound: false,
    kakao: false,
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
  const [sendKakaoLoading, setSendKakaoLoading] = useState(false);
  const [kakaoPhone, setKakaoPhone] = useState("");
  const [kakaoTemplateCode, setKakaoTemplateCode] = useState("");

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
    const kakaoSettingsRaw = localStorage.getItem(KAKAO_SETTINGS_STORAGE_KEY);
    if (!kakaoSettingsRaw) {
      return;
    }

    try {
      const parsed = JSON.parse(kakaoSettingsRaw) as { phone?: string; templateCode?: string };
      if (typeof parsed.phone === "string") {
        setKakaoPhone(parsed.phone);
      }
      if (typeof parsed.templateCode === "string") {
        setKakaoTemplateCode(parsed.templateCode);
      }
    } catch {
      // ignore invalid localStorage values
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      KAKAO_SETTINGS_STORAGE_KEY,
      JSON.stringify({ phone: kakaoPhone, templateCode: kakaoTemplateCode }),
    );
  }, [kakaoPhone, kakaoTemplateCode]);

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

    const metadataPhone = toTextInputValue(metadata.phone) || toTextInputValue(metadata.phone_number);
    if (metadataPhone) {
      setKakaoPhone((prev) => prev || metadataPhone);
    }
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
        setError(e instanceof Error ? e.message : "마이페이지 정보를 불러오지 못했습니다.");
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
      toast.error("이 브라우저는 웹 푸시 알림을 지원하지 않습니다.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === "granted") {
        updateNotificationSetting("push", true);
        toast.success("푸시 권한이 승인되었습니다.");
      } else if (permission === "denied") {
        updateNotificationSetting("push", false);
        toast.error(
          "현재 브라우저에서 푸시 알림이 차단되어 있습니다. 주소창의 사이트 권한에서 알림을 허용한 뒤 다시 시도해 주세요.",
        );
      } else {
        updateNotificationSetting("push", false);
        toast("푸시 알림 권한이 아직 허용되지 않았습니다.");
      }
    } catch {
      toast.error("푸시 권한 요청에 실패했습니다.");
    }
  };

  const sendTestPush = async () => {
    if (!isPushSupported) {
      toast.error("이 브라우저는 웹 푸시 알림을 지원하지 않습니다.");
      return;
    }

    if (Notification.permission !== "granted") {
      setPushPermission(Notification.permission);
      toast.error("먼저 푸시 권한을 허용해 주세요.");
      return;
    }

    try {
      setSendPushLoading(true);
      new Notification("푸시 테스트", {
        body: "마이페이지에서 보낸 테스트 알림입니다.",
      });
      toast.success("테스트 푸시를 전송했습니다.");
    } catch {
      toast.error("테스트 푸시 전송에 실패했습니다.");
    } finally {
      setSendPushLoading(false);
    }
  };

  const normalizeKakaoPhone = (value: string) => value.replace(/\D/g, "");

  const sendTestKakao = async () => {
    if (!notificationSettings.kakao) {
      toast.error("카카오톡 알림이 비활성화되어 있습니다. 토글을 먼저 켜주세요.");
      return;
    }

    const rawPhone = normalizeKakaoPhone(kakaoPhone);
    if (!rawPhone) {
      toast.error("카카오톡 수신 전화번호를 입력해 주세요.");
      return;
    }

    if (rawPhone.length < 10 || rawPhone.length > 11) {
      toast.error("전화번호는 숫자 기준 10~11자리여야 합니다.");
      return;
    }

    try {
      setSendKakaoLoading(true);
      await apiClient.post("/customer/notifications/send-kakao", {
        phone: rawPhone,
        message: KAKAO_TEST_MESSAGE,
        templateCode: kakaoTemplateCode.trim() || undefined,
      });
      toast.success("카카오톡 테스트 알림 전송 요청이 완료되었습니다.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "카카오톡 테스트 전송에 실패했습니다.");
    } finally {
      setSendKakaoLoading(false);
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
      toast.success("프로필이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "프로필 저장에 실패했습니다.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== DELETE_CONFIRM_TEXT) {
      toast.error(`"${DELETE_CONFIRM_TEXT}"를 입력해 주세요.`);
      return;
    }

    try {
      setDeleting(true);
      await apiClient.delete("/customer/account");
      toast.success("회원 탈퇴가 완료되었습니다.");
      await signOut();
    } catch {
      toast.error("현재 환경에서 계정 탈퇴 API가 준비되지 않았습니다. 관리자에게 문의하세요.");
    } finally {
      setDeleting(false);
    }
  };

  const totalBranches = storeGroups.reduce((acc, group) => acc + group.branches.length, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold text-foreground">마이페이지</h1>
        <div className="card p-6 text-text-tertiary">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold text-foreground">마이페이지</h1>
        <div className="border border-danger-500 rounded-lg p-4 bg-danger-500/10 text-danger-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">마이페이지</h1>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-foreground">프로필 커스터마이징</h2>
          <Link href="/customer/order" target="_blank" className="text-sm text-text-secondary underline">
            주문 페이지 열기
          </Link>
        </div>

        <div className="text-sm text-text-secondary mb-4">계정: {user?.email ?? "-"}</div>

        <form onSubmit={handleProfileSave} className="grid gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">표시 이름</label>
            <input
              value={profile.displayName}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, displayName: event.target.value }))
              }
              className="input-field"
              placeholder="표시 이름을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">한 줄 소개</label>
            <textarea
              value={profile.tagline}
              onChange={(event) => setProfile((prev) => ({ ...prev, tagline: event.target.value }))}
              className="input-field min-h-20"
              placeholder="짧은 소개를 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">테마 색상</label>
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
            {savingProfile ? "저장 중..." : "프로필 저장"}
          </button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold text-foreground mb-4">알림 설정</h2>
        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">수신 채널</h3>
            <label className="flex items-center justify-between gap-3 py-2 border-b border-border/40">
              <span>이메일 알림</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={notificationSettings.email}
                onChange={(event) => updateNotificationSetting("email", event.target.checked)}
              />
            </label>
            <p className="text-xs text-text-tertiary -mt-1">
              주문/결제 상태를 이메일로 받습니다.
            </p>

            <label className="flex items-center justify-between gap-3 py-2 border-b border-border/40">
              <span>마케팅 알림</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={notificationSettings.marketing}
                onChange={(event) => updateNotificationSetting("marketing", event.target.checked)}
              />
            </label>
            <p className="text-xs text-text-tertiary -mt-1">
              공지, 이벤트, 혜택 안내를 받습니다.
            </p>

            <label className="flex items-center justify-between gap-3 py-2 border-b border-border/40">
              <span>알림음</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={notificationSettings.sound}
                onChange={(event) => updateNotificationSetting("sound", event.target.checked)}
              />
            </label>
            <p className="text-xs text-text-tertiary -mt-1">
              주문 상태 알림이 생성될 때 소리를 재생할지 설정합니다.
            </p>

            <label className="flex items-center justify-between gap-3 py-2">
              <span>카카오톡 알림</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={notificationSettings.kakao}
                onChange={(event) => updateNotificationSetting("kakao", event.target.checked)}
              />
            </label>
            <p className="text-xs text-text-tertiary -mt-1">
              주문/매장 상태 알림을 카카오톡으로 받습니다.
            </p>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="font-semibold text-foreground">푸시 알림</h3>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>현재 브라우저 권한</span>
              <span className="text-text-secondary">{pushPermission}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={requestPushPermission} className="btn-primary px-4 py-2 text-sm">
                푸시 알림 권한 요청
              </button>
              <button
                onClick={sendTestPush}
                disabled={sendPushLoading || pushPermission !== "granted"}
                className="px-4 py-2 rounded border border-border bg-transparent text-text-secondary text-sm disabled:opacity-60"
              >
                {sendPushLoading ? "전송 중..." : "테스트 푸시 보내기"}
              </button>
            </div>
            <label className="flex items-center justify-between gap-3 py-2 border-t border-border mt-1 pt-3">
              <span>푸시 알림 활성화</span>
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
            <p className="text-xs text-text-tertiary">
              브라우저 권한이 차단된 경우, 브라우저 설정에서 알림을 허용으로 변경 후 다시 요청해 주세요.
            </p>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="font-semibold text-foreground">카카오톡 테스트 발송</h3>
            <div className="grid gap-2">
              <label className="block text-sm text-text-secondary">수신 전화번호</label>
              <input
                value={kakaoPhone}
                onChange={(event) =>
                  setKakaoPhone(event.target.value)
                }
                className="input-field"
                placeholder="01012345678"
                inputMode="numeric"
              />
            </div>
            <div className="grid gap-2">
              <label className="block text-sm text-text-secondary">템플릿 코드(선택)</label>
              <input
                value={kakaoTemplateCode}
                onChange={(event) => setKakaoTemplateCode(event.target.value)}
                className="input-field"
                placeholder="템플릿 코드 미입력 시 기본 템플릿 사용"
              />
            </div>
            <button
              onClick={sendTestKakao}
              disabled={sendKakaoLoading}
              className="btn-primary px-4 py-2 text-sm"
            >
              {sendKakaoLoading ? "전송 중..." : "카카오톡 테스트 보내기"}
            </button>
            <p className="text-xs text-text-tertiary">
              `카카오톡 테스트 알림` 메시지가 입력한 번호로 전송됩니다.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold text-foreground mb-4">매장 목록</h2>
        <div className="text-sm text-text-secondary mb-3">
          총 {storeGroups.length}개 브랜드 · {totalBranches}개 매장
        </div>

        {storeGroups.length === 0 ? (
          <div className="text-text-tertiary">연결된 브랜드 또는 매장이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {storeGroups.map((group) => (
              <div key={group.id} className="border border-border rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <div className="font-semibold text-foreground">{group.name}</div>
                    <div className="text-xs text-text-tertiary">브랜드 슬러그: {group.slug || "-"}</div>
                  </div>
                  <Link
                    href={`/customer/brands/${group.id}`}
                    className="text-sm text-text-secondary underline"
                  >
                    브랜드 관리로 이동
                  </Link>
                </div>

                {group.branches.length === 0 ? (
                  <div className="text-xs text-text-tertiary">이 브랜드에 매장이 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {group.branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="rounded border border-border/80 p-2 text-sm bg-bg-tertiary/40"
                      >
                        <div className="font-semibold text-foreground">{branch.name}</div>
                        <div className="text-xs text-text-tertiary mt-1">매장 슬러그: {branch.slug || "-"}</div>
                        <div className="text-xs text-text-secondary mt-1 break-all">
                          주문 URL: {branch.orderUrl}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            href={branch.orderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline text-text-secondary"
                          >
                            주문 페이지 열기
                          </Link>
                          <Link
                            href={`/customer/branches/${branch.id}`}
                            className="text-xs underline text-text-secondary"
                          >
                            매장 관리
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
        <h2 className="text-lg font-bold text-foreground mb-4">계정</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={signOut}
            className="py-2.5 px-4 rounded border border-border text-text-secondary bg-transparent hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            로그아웃
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <div className="text-sm text-text-secondary mb-2">계정 탈퇴</div>
          <p className="text-xs text-text-tertiary mb-3">
            버튼을 누르기 전에 <span className="font-semibold text-text-secondary">{DELETE_CONFIRM_TEXT}</span>를 입력하세요.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              className="input-field max-w-[140px]"
              placeholder={DELETE_CONFIRM_TEXT}
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="py-2.5 px-4 rounded border border-danger-500 text-danger-500 text-sm cursor-pointer hover:bg-danger-500/10 transition-colors disabled:opacity-50"
            >
              {deleting ? "처리 중..." : "계정 탈퇴"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
