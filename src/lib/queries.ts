/**
 * TanStack Query hooks over `data`. Query keys include the signed-in user wherever the answer
 * depends on who is asking, so signing in or out refetches the right things.
 */
import {
  focusManager,
  type InfiniteData,
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { data, type FeedFilter } from './api';
import type { ReportReason } from './data/source';
import type { CommentMedia, LocalImage, Page, ProfilePatch, Reel, User } from './types';
import { useSessionUserId } from './session';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

// Treat "app came to the foreground" as window focus, so stale screens refresh.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active'));
    return () => sub.remove();
  });
}

export const keys = {
  feed: (filter: FeedFilter, uid: string | null | undefined) =>
    filter.saved
      ? (['feed', 'saved', uid ?? null] as const)
      : filter.supporting
        ? (['feed', 'supporting', uid ?? null] as const)
        : ([
          'feed',
          'public',
          filter.hashtag ?? null,
          filter.username ?? null,
          filter.club?.toLowerCase() ?? null,
          filter.sort ?? null,
          filter.challenge ?? null,
          filter.respondsTo ?? null,
        ] as const),
  challenges: ['challenges'] as const,
  savedStickers: (uid: string | null | undefined) => ['saved-stickers', uid ?? null] as const,
  challenge: (id: string) => ['challenges', id] as const,
  savedFeed: ['feed', 'saved'] as const,
  supportingFeed: ['feed', 'supporting'] as const,
  clubFans: (club: string) => ['club-fans', club.toLowerCase()] as const,
  clubWars: ['pulse', 'clubs'] as const,
  topFans: (country: string | null) => ['pulse', 'fans', country] as const,
  myWeek: (uid: string | null | undefined) => ['pulse', 'me', uid ?? null] as const,
  mySupports: (uid: string | null | undefined) => ['my-supports', uid ?? null] as const,
  relations: (uid: string | null | undefined) => ['relations', uid ?? null] as const,
  blockedUsers: (uid: string | null | undefined) => ['blocked-users', uid ?? null] as const,
  usernameAvailable: (name: string) => ['username-available', name] as const,
  reel: (id: string) => ['reel', id] as const,
  user: (id: string) => ['user', id] as const,
  username: (username: string) => ['username', username] as const,
  me: (uid: string | null | undefined) => ['me', uid ?? null] as const,
  trending: ['hashtags', 'trending'] as const,
  hashtag: (name: string) => ['hashtag', name] as const,
  comments: (reelId: string) => ['comments', reelId] as const,
  notifications: (uid: string | null | undefined) => ['notifications', uid ?? null] as const,
  search: (q: string) => ['search', q] as const,
};

export function useFeed(filter: FeedFilter = {}, { enabled = true }: { enabled?: boolean } = {}) {
  const uid = useSessionUserId();
  const query = useInfiniteQuery({
    queryKey: keys.feed(filter, uid),
    queryFn: ({ pageParam }) => data.feed(filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Saved and Supporting belong to whoever is signed in; wait until we know who that is.
    enabled: enabled && ((!filter.saved && !filter.supporting) || uid !== undefined),
  });
  // A reel can land on two pages if the ranking shifted between them; show it once.
  const reels = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages.flatMap((p) => p.items) ?? []).filter((r) => !seen.has(r.id) && !!seen.add(r.id));
  }, [query.data]);
  return { ...query, reels };
}

export function useReel(id: string | undefined) {
  return useQuery({ queryKey: keys.reel(id ?? ''), queryFn: () => data.reel(id!), enabled: !!id });
}

export function useUser(id: string | undefined) {
  return useQuery({ queryKey: keys.user(id ?? ''), queryFn: () => data.user(id!), enabled: !!id });
}

export function useUserByUsername(username: string | undefined) {
  return useQuery({
    queryKey: keys.username(username ?? ''),
    queryFn: () => data.userByUsername(username!),
    enabled: !!username,
  });
}

/** The signed-in user's profile. `data` is null when signed out. */
export function useMe() {
  const uid = useSessionUserId();
  return useQuery({ queryKey: keys.me(uid), queryFn: () => data.me(), enabled: uid !== undefined });
}

export function useTrendingHashtags() {
  return useQuery({ queryKey: keys.trending, queryFn: () => data.trendingHashtags() });
}

export function useHashtag(name: string | undefined) {
  return useQuery({ queryKey: keys.hashtag(name ?? ''), queryFn: () => data.hashtag(name!), enabled: !!name });
}

export function useComments(reelId: string | undefined) {
  return useQuery({
    queryKey: keys.comments(reelId ?? ''),
    queryFn: () => data.comments(reelId!),
    enabled: !!reelId,
  });
}

export function useNotifications() {
  const uid = useSessionUserId();
  return useQuery({
    queryKey: keys.notifications(uid),
    queryFn: () => data.notifications(),
    enabled: uid !== undefined,
  });
}

/** Search as you type, waiting for a 250 ms pause. */
export function useSearch(raw: string) {
  const [q, setQ] = useState(raw.trim());
  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 250);
    return () => clearTimeout(t);
  }, [raw]);
  return useQuery({
    queryKey: keys.search(q),
    queryFn: () => data.search(q),
    enabled: q.length > 0,
    placeholderData: (prev) => prev,
  });
}

export function useClubFans(club: string | undefined) {
  return useQuery({
    queryKey: keys.clubFans(club ?? ''),
    queryFn: () => data.clubFans(club!),
    enabled: !!club,
  });
}

// ---- Pulse Rank and Club Wars (weekly tables move slowly; a minute's staleness is fine)

export function useClubWars() {
  return useQuery({ queryKey: keys.clubWars, queryFn: () => data.clubWars(), staleTime: 60_000 });
}

export function useTopFans(country: string | null, enabled = true) {
  return useQuery({ queryKey: keys.topFans(country), queryFn: () => data.topFans(country), staleTime: 60_000, enabled });
}

export function useMyWeek() {
  const uid = useSessionUserId();
  return useQuery({ queryKey: keys.myWeek(uid), queryFn: () => data.myWeek(), enabled: !!uid, staleTime: 60_000 });
}

/** This week's challenge and last week's (with its winner). */
export function useChallenges() {
  return useQuery({ queryKey: keys.challenges, queryFn: () => data.challenges(), staleTime: 60_000 });
}

export function useChallenge(id: string | undefined) {
  return useQuery({ queryKey: keys.challenge(id ?? ''), queryFn: () => data.challenge(id!), enabled: !!id });
}

/** Creator ids the signed-in user supports (empty when signed out). */
export function useMySupports() {
  const uid = useSessionUserId();
  return useQuery({ queryKey: keys.mySupports(uid), queryFn: () => data.mySupports(), enabled: uid !== undefined });
}

/** Who the signed-in user blocked and muted. */
export function useMyRelations() {
  const uid = useSessionUserId();
  return useQuery({ queryKey: keys.relations(uid), queryFn: () => data.myRelations(), enabled: uid !== undefined });
}

export function useBlockedUsers() {
  const uid = useSessionUserId();
  return useQuery({ queryKey: keys.blockedUsers(uid), queryFn: () => data.blockedUsers(), enabled: !!uid });
}

export function useUsernameAvailable(name: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.usernameAvailable(name),
    queryFn: () => data.usernameAvailable(name),
    enabled,
    staleTime: 5_000,
  });
}

// ---------------------------------------------------------------- writes

export function useAddComment(reelId: string) {
  return useMutation({
    mutationFn: ({ body, media = null }: { body: string; media?: CommentMedia | null }) =>
      data.addComment(reelId, body, null, media),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.comments(reelId) });
      queryClient.invalidateQueries({ queryKey: keys.reel(reelId) });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/** "My stickers": stickers and GIFs the signed-in user saved. */
export function useSavedStickers(enabled = true) {
  const uid = useSessionUserId();
  return useQuery({
    queryKey: keys.savedStickers(uid),
    queryFn: () => data.savedStickers(),
    enabled: enabled && !!uid,
  });
}

export function useSetSavedSticker() {
  return useMutation({
    mutationFn: ({ media, on }: { media: CommentMedia; on: boolean }) => data.setSavedSticker(media, on),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-stickers'] }),
  });
}

export function useMarkNotificationsRead() {
  return useMutation({
    mutationFn: () => data.markNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/** After the signed-in user's profile changes: show it now, refetch everything that embeds it. */
function profileChanged(updated: User) {
  // Update the cached profile right away so screens (and the onboarding gate) see it now.
  queryClient.setQueriesData({ queryKey: ['me'] }, updated);
  queryClient.invalidateQueries({ queryKey: ['user'] });
  queryClient.invalidateQueries({ queryKey: ['username'] });
  queryClient.invalidateQueries({ queryKey: ['club-fans'] });
  queryClient.invalidateQueries({ queryKey: ['feed'] });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (patch: ProfilePatch) => data.updateProfile(patch),
    onSuccess: profileChanged,
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: (image: LocalImage) => data.uploadAvatar(image),
    onSuccess: profileChanged,
  });
}

export function useDeleteReel() {
  return useMutation({
    mutationFn: (reelId: string) => data.deleteReel(reelId),
    onSuccess: (_, reelId) => {
      queryClient.removeQueries({ queryKey: keys.reel(reelId) });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['hashtags'] });
    },
  });
}

/** After a block or mute: what you can see changes almost everywhere. */
function relationsChanged() {
  queryClient.invalidateQueries({ queryKey: ['relations'] });
  queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
  queryClient.invalidateQueries({ queryKey: ['feed'] });
  queryClient.invalidateQueries({ queryKey: ['reel'] });
  queryClient.invalidateQueries({ queryKey: ['comments'] });
  queryClient.invalidateQueries({ queryKey: ['search'] });
  queryClient.invalidateQueries({ queryKey: ['my-supports'] });
  queryClient.invalidateQueries({ queryKey: ['user'] });
  queryClient.invalidateQueries({ queryKey: ['username'] });
  queryClient.invalidateQueries({ queryKey: ['me'] });
}

export function useSetBlock() {
  return useMutation({
    mutationFn: ({ userId, on }: { userId: string; on: boolean }) => data.setBlock(userId, on),
    onSuccess: relationsChanged,
  });
}

export function useSetMute() {
  return useMutation({
    mutationFn: ({ userId, on }: { userId: string; on: boolean }) => data.setMute(userId, on),
    onSuccess: relationsChanged,
  });
}

type FeedCache = InfiniteData<Page<Reel>, string | null>;

/** "Not interested": the reel disappears from public feeds at once, then the server remembers it. */
export function useNotInterested() {
  return useMutation({
    mutationFn: (reelId: string) => data.notInterested(reelId),
    onMutate: (reelId) => {
      queryClient.setQueriesData<FeedCache>({ queryKey: ['feed', 'public'] }, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((r) => r.id !== reelId) })) } : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['feed', 'public'] }),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (input: { reelId: string; reason: ReportReason; details?: string }) => data.report(input),
  });
}
