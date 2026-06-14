'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { supabaseBrowser } from '@/lib/supabase/client';

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

type NotificationSettingKey =
  | 'email'
  | 'push'
  | 'marketing'
  | 'sound'
  | 'kakao';

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

type MeProfileResponse = {
  id: string;
  displayName?: string | null;
};

const SETTINGS_STORAGE_KEY = 'customer:mypage:notification-settings';
const KAKAO_SETTINGS_STORAGE_KEY =
  'customer:mypage:kakao-notification-settings';
const DELETE_CONFIRM_TEXT = '탈퇴';
const KAKAO_TEST_MESSAGE =
  '테스트 메시지입니다. 카카오톡 알림이 정상적으로 발송되었습니다.';

function getDefaultSettings(): NotificationSettings {
  return {
    email: true,
    push: false,
    marketing: false,
    sound: false,
    kakao: false,
  };
}

function getOrderUrl(
  brandSlug: string | null,
  branchSlug: string | null,
  branchId: string,
): string {
  if (!brandSlug) {
    return `/order/branch/${branchId}`;
  }

  if (branchSlug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branchSlug)}`;
  }

  return `/order/${encodeURIComponent(brandSlug)}`;
}

function toTextInputValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getPushPermissionLabel(permission: NotificationPermission): string {
  switch (permission) {
    case 'granted':
      return '허용됨';
    case 'denied':
      return '차단됨';
    default:
      return '아직 선택 안 함';
  }
}

function getPushPermissionBadgeClass(
  permission: NotificationPermission,
): string {
  switch (permission) {
    case 'granted':
      return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30';
    case 'denied':
      return 'bg-red-500/10 text-red-600 border border-red-500/30';
    default:
      return 'bg-bg-tertiary text-text-secondary border border-border';
  }
}

export default function CustomerMyPage() {
  const { user, signOut, refresh } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileState>({
    displayName: '',
    tagline: '',
    themeColor: '#3B82F6',
  });

  const [savingProfile, setSavingProfile] = useState(false);

  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(getDefaultSettings());

  const [pushPermission, setPushPermission] =
    useState<NotificationPermission>('default');
  const [sendPushLoading, setSendPushLoading] = useState(false);
  const [sendKakaoLoading, setSendKakaoLoading] = useState(false);
  const [kakaoPhone, setKakaoPhone] = useState('');
  const [kakaoTemplateCode, setKakaoTemplateCode] = useState('');

  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);

  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isPushSupported =
    typeof window !== 'undefined' && typeof Notification !== 'undefined';

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
      const parsed = JSON.parse(
        savedSettingsRaw,
      ) as Partial<NotificationSettings>;
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
      const parsed = JSON.parse(kakaoSettingsRaw) as {
        phone?: string;
        templateCode?: string;
      };
      if (typeof parsed.phone === 'string') {
        setKakaoPhone(parsed.phone);
      }
      if (typeof parsed.templateCode === 'string') {
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
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(notificationSettings),
    );
  }, [notificationSettings]);

  useEffect(() => {
    const userMetadata = user?.user_metadata;
    if (!userMetadata || typeof userMetadata !== 'object') {
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

    const metadataPhone =
      toTextInputValue(metadata.phone) ||
      toTextInputValue(metadata.phone_number);
    if (metadataPhone) {
      setKakaoPhone((prev) => prev || metadataPhone);
    }
  }, [user?.user_metadata]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [profileResult, brands, branches] = await Promise.all([
          apiClient.get<MeProfileResponse>('/me/profile').catch(() => null),
          apiClient.get<BrandSummary[]>('/customer/brands'),
          apiClient.get<BranchSummary[]>('/customer/branches').catch(() => []),
        ]);

        if (profileResult) {
          setProfile((prev) => ({
            ...prev,
            displayName: toTextInputValue(profileResult.displayName),
          }));
        }

        const branchesByBrand = new Map<string, BranchSummary[]>();
        for (const branch of branches) {
          const current = branchesByBrand.get(branch.brandId) ?? [];
          current.push(branch);
          branchesByBrand.set(branch.brandId, current);
        }

        const groups = brands.map((brand) => ({
          ...brand,
          branches: (branchesByBrand.get(brand.id) ?? []).map((branch) => ({
            ...branch,
            brandSlug: brand.slug,
            orderUrl: getOrderUrl(brand.slug, branch.slug, branch.id),
          })),
        }));

        setStoreGroups(groups);
      } catch (e) {
        console.error(e);
        setError(
          e instanceof Error
            ? e.message
            : '마이페이지 정보를 불러오지 못했습니다.',
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateNotificationSetting = (
    key: NotificationSettingKey,
    value: boolean,
  ) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: value }));
  };

  const requestPushPermission = async () => {
    if (!isPushSupported) {
      toast.error('이 브라우저는 웹 푸시 알림을 지원하지 않습니다.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        updateNotificationSetting('push', true);
        toast.success('푸시 권한이 승인되었습니다.');
      } else if (permission === 'denied') {
        updateNotificationSetting('push', false);
        toast.error(
          '현재 브라우저에서 푸시 알림이 차단되어 있습니다. 주소창의 사이트 권한에서 알림을 허용한 뒤 다시 시도해 주세요.',
        );
      } else {
        updateNotificationSetting('push', false);
        toast('푸시 알림 권한이 아직 허용되지 않았습니다.');
      }
    } catch {
      toast.error('푸시 권한 요청에 실패했습니다.');
    }
  };

  const sendTestPush = () => {
    if (!isPushSupported) {
      toast.error('이 브라우저는 웹 푸시 알림을 지원하지 않습니다.');
      return;
    }

    if (Notification.permission !== 'granted') {
      setPushPermission(Notification.permission);
      toast.error('먼저 푸시 권한을 허용해 주세요.');
      return;
    }

    try {
      setSendPushLoading(true);
      new Notification('푸시 테스트', {
        body: '마이페이지에서 보낸 테스트 알림입니다.',
      });
      toast.success('테스트 푸시를 전송했습니다.');
    } catch {
      toast.error('테스트 푸시 전송에 실패했습니다.');
    } finally {
      setSendPushLoading(false);
    }
  };

  const normalizeKakaoPhone = (value: string) => value.replace(/\D/g, '');

  const sendTestKakao = async () => {
    if (!notificationSettings.kakao) {
      toast.error(
        '카카오톡 알림이 비활성화되어 있습니다. 토글을 먼저 켜주세요.',
      );
      return;
    }

    const rawPhone = normalizeKakaoPhone(kakaoPhone);
    if (!rawPhone) {
      toast.error('카카오톡 수신 전화번호를 입력해 주세요.');
      return;
    }

    if (rawPhone.length < 10 || rawPhone.length > 11) {
      toast.error('전화번호는 숫자 기준 10~11자리여야 합니다.');
      return;
    }

    try {
      setSendKakaoLoading(true);
      await apiClient.post('/customer/notifications/send-kakao', {
        phone: rawPhone,
        message: KAKAO_TEST_MESSAGE,
        templateCode: kakaoTemplateCode.trim() || undefined,
      });
      toast.success('카카오톡 테스트 알림 전송 요청이 완료되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : '카카오톡 테스트 전송에 실패했습니다.',
      );
    } finally {
      setSendKakaoLoading(false);
    }
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSavingProfile(true);

      const profileResult = await apiClient.patch<MeProfileResponse>(
        '/me/profile',
        {
          displayName: profile.displayName,
        },
      );

      const { error: updateError } = await supabaseBrowser.auth.updateUser({
        data: {
          display_name: profileResult.displayName || null,
          profile_tagline: profile.tagline || null,
          profile_theme_color: profile.themeColor || null,
        },
      });

      if (updateError) {
        throw updateError;
      }

      setProfile((prev) => ({
        ...prev,
        displayName: toTextInputValue(profileResult.displayName),
      }));
      await refresh();
      toast.success('프로필이 저장되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : '프로필 저장에 실패했습니다.',
      );
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
      await apiClient.delete('/customer/account');
      toast.success('회원 탈퇴가 완료되었습니다.');
      await signOut();
    } catch {
      toast.error(
        '현재 환경에서 계정 탈퇴 API가 준비되지 않았습니다. 관리자에게 문의하세요.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const totalBranches = storeGroups.reduce(
    (acc, group) => acc + group.branches.length,
    0,
  );

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
        <div className="border border-danger-500 rounded-lg p-4 bg-danger-500/10 text-danger-500">
          {error}
        </div>
      </div>
    );
  }

  // ── 알림 행 항목 정의 ──
  const notificationRows: {
    key: NotificationSettingKey;
    label: string;
    description: string;
  }[] = [
    {
      key: 'email',
      label: '이메일 알림',
      description: '주문/결제 상태를 이메일로 받습니다.',
    },
    {
      key: 'marketing',
      label: '마케팅 알림',
      description: '공지, 이벤트, 혜택 안내를 받습니다.',
    },
    {
      key: 'sound',
      label: '알림음',
      description: '주문 상태 알림이 생성될 때 소리를 재생합니다.',
    },
    {
      key: 'kakao',
      label: '카카오톡 알림',
      description: '주문/스토어 상태 알림을 카카오톡으로 받습니다.',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">마이페이지</h1>

      {/* ── 1. 프로필 ── */}
      <section className="card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">
            프로필 커스터마이징
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {user?.email ?? '-'}
          </p>
        </div>

        <form
          onSubmit={(event) => {
            void handleProfileSave(event);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">
              표시 이름
            </label>
            <input
              value={profile.displayName}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  displayName: event.target.value,
                }))
              }
              className="input-field w-full"
              placeholder="표시 이름을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">
              한 줄 소개
            </label>
            <textarea
              value={profile.tagline}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, tagline: event.target.value }))
              }
              className="input-field w-full min-h-20"
              placeholder="짧은 소개를 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">
              테마 색상
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={profile.themeColor}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    themeColor: event.target.value,
                  }))
                }
                className="h-10 w-12 rounded-lg cursor-pointer border border-border bg-transparent p-0.5"
              />
              <input
                value={profile.themeColor}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    themeColor: event.target.value,
                  }))
                }
                className="input-field flex-1 font-mono"
                placeholder="#3B82F6"
              />
              {/* 색상 미리보기 뱃지 */}
              <div
                className="h-8 w-8 rounded-lg border border-border flex-shrink-0"
                style={{ backgroundColor: profile.themeColor }}
                title={profile.themeColor}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary py-2.5 px-5 text-sm"
            >
              {savingProfile ? '저장 중...' : '프로필 저장'}
            </button>
          </div>
        </form>
      </section>

      {/* ── 2. 스토어 목록 ── */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-foreground">스토어 목록</h2>
          <span className="text-xs text-text-tertiary">
            {storeGroups.length}개 브랜드 · {totalBranches}개 스토어
          </span>
        </div>

        {storeGroups.length === 0 ? (
          <div className="text-sm text-text-tertiary">
            연결된 브랜드 또는 스토어가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {storeGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-border p-4"
              >
                {/* 브랜드 헤더 */}
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="font-bold text-foreground">
                      {group.name}
                    </div>
                    {group.slug && (
                      <div className="text-xs text-text-tertiary mt-0.5">
                        주문 URL: /order/{encodeURIComponent(group.slug)}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/customer/brands/${group.id}`}
                    className="text-xs text-text-secondary hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    브랜드/셀러 관리
                  </Link>
                </div>

                {/* 매장 목록 */}
                {group.branches.length === 0 ? (
                  <p className="text-xs text-text-tertiary">
                    이 브랜드에 스토어/출고지가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2 ml-1 pl-3 border-l border-border">
                    {group.branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="rounded-lg border border-border/60 p-3 bg-bg-tertiary/30"
                      >
                        <div className="font-semibold text-sm text-foreground mb-1">
                          {branch.name}
                        </div>
                        <div className="text-xs text-text-tertiary break-all mb-2">
                          주문 URL: {branch.orderUrl}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={branch.orderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center h-7 px-3 rounded-lg border border-border bg-bg-secondary text-xs font-medium text-text-secondary hover:text-foreground transition-colors"
                          >
                            주문 링크 열기
                          </Link>
                          <Link
                            href={`/customer/branches/${branch.id}`}
                            className="text-xs text-text-secondary hover:text-foreground underline underline-offset-2 transition-colors"
                          >
                            스토어 관리
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

      {/* ── 3. 알림 설정 ── */}
      <section className="card p-5">
        <h2 className="text-lg font-bold text-foreground mb-4">알림 설정</h2>

        {/* 수신 채널 행 목록 */}
        <div className="space-y-2 mb-6">
          {notificationRows.map(({ key, label, description }) => (
            <label
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-bg-secondary px-4 py-3 cursor-pointer hover:bg-bg-tertiary transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  {label}
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {description}
                </div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary flex-shrink-0"
                checked={notificationSettings[key]}
                onChange={(event) =>
                  updateNotificationSetting(key, event.target.checked)
                }
              />
            </label>
          ))}
        </div>

        {/* 푸시 알림 */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">푸시 알림</h3>

          {/* 권한 상태 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">브라우저 권한</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getPushPermissionBadgeClass(pushPermission)}`}
            >
              {getPushPermissionLabel(pushPermission)}
            </span>
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void requestPushPermission();
              }}
              className="btn-primary px-4 py-2 text-sm"
            >
              권한 요청
            </button>
            <button
              type="button"
              onClick={sendTestPush}
              disabled={sendPushLoading || pushPermission !== 'granted'}
              className="px-4 py-2 rounded-lg border border-border bg-transparent text-text-secondary text-sm hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            >
              {sendPushLoading ? '전송 중...' : '테스트 푸시 보내기'}
            </button>
          </div>

          {/* 푸시 활성화 토글 행 */}
          <label className="flex items-center justify-between gap-4 pt-3 border-t border-border cursor-pointer">
            <div>
              <div className="text-sm font-semibold text-foreground">
                푸시 알림 활성화
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                브라우저 권한이 차단된 경우, 브라우저 설정에서 알림을 허용 후
                다시 요청해 주세요.
              </div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary flex-shrink-0"
              checked={notificationSettings.push}
              disabled={pushPermission !== 'granted'}
              onChange={(event) => {
                if (pushPermission === 'granted') {
                  updateNotificationSetting('push', event.target.checked);
                }
              }}
            />
          </label>
        </div>

        {/* 카카오톡 테스트 발송 */}
        <div className="rounded-xl border border-border p-4 space-y-3 mt-4">
          <h3 className="text-sm font-bold text-foreground">
            카카오톡 테스트 발송
          </h3>
          <p className="text-xs text-text-tertiary">
            카카오톡 테스트 알림 메시지가 입력한 번호로 전송됩니다.
          </p>

          <div className="grid gap-2">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                수신 전화번호
              </label>
              <input
                value={kakaoPhone}
                onChange={(event) => setKakaoPhone(event.target.value)}
                className="input-field w-full"
                placeholder="01012345678"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                템플릿 코드 (선택)
              </label>
              <input
                value={kakaoTemplateCode}
                onChange={(event) => setKakaoTemplateCode(event.target.value)}
                className="input-field w-full"
                placeholder="미입력 시 기본 템플릿 사용"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                void sendTestKakao();
              }}
              disabled={sendKakaoLoading}
              className="btn-primary px-4 py-2 text-sm"
            >
              {sendKakaoLoading ? '전송 중...' : '카카오톡 테스트 보내기'}
            </button>
          </div>
        </div>
      </section>

      {/* ── 4. 계정 ── */}
      <section className="card p-5">
        <h2 className="text-lg font-bold text-foreground mb-4">계정</h2>

        <button
          type="button"
          onClick={() => {
            void signOut();
          }}
          className="py-2.5 px-5 rounded-lg border border-border text-text-secondary bg-transparent hover:bg-bg-tertiary transition-colors text-sm font-medium"
        >
          로그아웃
        </button>

        {/* 위험 구역: 계정 탈퇴 */}
        <div className="mt-6 rounded-xl border border-danger-500/40 bg-danger-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-danger-500">계정 탈퇴</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-500/10 text-danger-500 border border-danger-500/30">
              위험
            </span>
          </div>
          <p className="text-xs text-text-tertiary mb-3">
            탈퇴 전{' '}
            <span className="font-semibold text-text-secondary">
              {DELETE_CONFIRM_TEXT}
            </span>
            를 아래에 입력하세요. 탈퇴 후에는 복구할 수 없습니다.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              className="input-field max-w-[140px]"
              placeholder={DELETE_CONFIRM_TEXT}
            />
            <button
              type="button"
              onClick={() => {
                void handleDeleteAccount();
              }}
              disabled={deleting}
              className="py-2.5 px-4 rounded-lg border border-danger-500 text-danger-500 text-sm font-semibold cursor-pointer hover:bg-danger-500/10 transition-colors disabled:opacity-50"
            >
              {deleting ? '처리 중...' : '계정 탈퇴'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
