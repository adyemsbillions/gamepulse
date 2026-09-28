import { router } from 'expo-router';
import { Flame, Hash, Search, Shield, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReelGrid } from '@/components/reel-grid';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { PulseLoader } from '@/components/ui/states';
import { getClubs, type SearchResults as Results } from '@/lib/api';
import { useFeed, useSearch, useTrendingHashtags } from '@/lib/queries';
import { formatCount } from '@/lib/format';

export default function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const search = useSearch(query);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.searchRow}>
        <Search size={18} color={Colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search GameMakers, #hashtags, clubs"
          placeholderTextColor={Colors.textSecondary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
            <X size={18} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {!searching ? (
          <DiscoverHome />
        ) : search.data ? (
          <SearchResults results={search.data} />
        ) : search.isError ? (
          <AppText color={Colors.textSecondary} style={styles.empty}>
            Search isn&apos;t working right now. Try again in a moment.
          </AppText>
        ) : (
          <View style={styles.loading}>
            <PulseLoader />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiscoverHome() {
  const tags = useTrendingHashtags().data ?? [];
  const feed = useFeed();
  return (
    <>
      {tags.length > 0 && <SectionTitle icon={<Flame size={18} color={Colors.hot} />} title="Hot Now" />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {tags.map((t) => (
          <Pressable key={t.name} style={styles.tagChip} onPress={() => router.push(`/hashtag/${t.name}`)}>
            <AppText variant="bodyBold" color={Colors.primary}>
              #{t.name}
            </AppText>
            <AppText variant="label" color={Colors.textSecondary}>
              {formatCount(t.usageCount)}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle icon={<Shield size={18} color={Colors.primary} />} title="Clubs" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {getClubs().map((club) => (
          <View key={club} style={styles.club}>
            <View style={styles.clubBadge}>
              <AppText style={styles.clubInitial} color={Colors.iceWhite}>
                {club[0]}
              </AppText>
            </View>
            <AppText variant="label" numberOfLines={1} style={styles.clubName}>
              {club}
            </AppText>
          </View>
        ))}
      </ScrollView>

      <SectionTitle title="Trending Moments" />
      {feed.isPending ? (
        <View style={styles.loading}>
          <PulseLoader />
        </View>
      ) : feed.reels.length > 0 ? (
        <ReelGrid reels={feed.reels} />
      ) : (
        <AppText color={Colors.textSecondary} style={styles.empty}>
          {feed.isError ? "Couldn't load Moments." : 'No Moments yet.'}
        </AppText>
      )}
    </>
  );
}

function SearchResults({ results }: { results: Results }) {
  const empty = !results.users.length && !results.hashtags.length && !results.reels.length;
  if (empty) {
    return (
      <AppText color={Colors.textSecondary} style={styles.empty}>
        No results. Try another name or #hashtag.
      </AppText>
    );
  }
  return (
    <>
      {results.users.length > 0 && <SectionTitle title="GameMakers" />}
      {results.users.map((u) => (
        <Pressable key={u.id} style={styles.row} onPress={() => router.push(`/user/${u.username}`)}>
          <Avatar user={u} size={44} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold">@{u.username}</AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              {u.displayName} · {formatCount(u.fans)} Fans
            </AppText>
          </View>
        </Pressable>
      ))}

      {results.hashtags.length > 0 && <SectionTitle title="Hashtags" />}
      {results.hashtags.map((h) => (
        <Pressable key={h.name} style={styles.row} onPress={() => router.push(`/hashtag/${h.name}`)}>
          <View style={styles.hashIcon}>
            <Hash size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold">#{h.name}</AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              {formatCount(h.usageCount)} Moments
            </AppText>
          </View>
        </Pressable>
      ))}

      {results.reels.length > 0 && <SectionTitle title="Moments" />}
      {results.reels.length > 0 && <ReelGrid reels={results.reels} />}
    </>
  );
}

function SectionTitle({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <View style={styles.section}>
      {icon}
      <AppText variant="heading">{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: Colors.text, paddingVertical: 0 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  chipsRow: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  tagChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  club: { alignItems: 'center', width: 72, gap: Spacing.one },
  clubBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.powderBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubInitial: { fontFamily: Fonts.display, fontSize: 22 },
  clubName: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  hashIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { textAlign: 'center', padding: Spacing.five },
  loading: { alignItems: 'center', padding: Spacing.five },
});
