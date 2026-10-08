import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

import { Sticker, STICKERS, stickerFor } from '@/components/stickers';
import { AppText } from '@/components/ui/app-text';
import { PulseLoader } from '@/components/ui/states';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { giphyEnabled, searchGifs, searchStickers, STICKER_CATEGORIES } from '@/lib/giphy';
import { useSavedStickers } from '@/lib/queries';
import type { CommentMedia } from '@/lib/types';

type Tab = 'gamepulse' | 'stickers' | 'gifs' | 'saved';

export const PICKER_HEIGHT = 320;

/** Sticker and GIF picker shown in place of the keyboard in the comments sheet. */
export function StickerPicker({ onPick }: { onPick: (media: CommentMedia) => void }) {
  const [tab, setTab] = useState<Tab>('gamepulse');
  return (
    <View style={styles.panel}>
      <View style={styles.tabs} accessibilityRole="tablist">
        <TabButton label="GamePulse" active={tab === 'gamepulse'} onPress={() => setTab('gamepulse')} />
        <TabButton label="Stickers" active={tab === 'stickers'} onPress={() => setTab('stickers')} />
        <TabButton label="GIFs" active={tab === 'gifs'} onPress={() => setTab('gifs')} />
        <TabButton label="Saved" active={tab === 'saved'} onPress={() => setTab('saved')} />
      </View>
      {tab === 'gamepulse' ? (
        <StickerGrid onPick={onPick} />
      ) : tab === 'stickers' ? (
        <GiphySearch type="stickers" onPick={onPick} />
      ) : tab === 'gifs' ? (
        <GiphySearch type="gifs" onPick={onPick} />
      ) : (
        <SavedGrid onPick={onPick} />
      )}
    </View>
  );
}

function StickerGrid({ onPick }: { onPick: (m: CommentMedia) => void }) {
  return (
    <FlatList
      data={STICKERS}
      keyExtractor={(s) => s.id}
      numColumns={4}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Send ${item.label} sticker`}
          onPress={() => onPick({ kind: 'sticker', url: `gp:${item.id}` })}
          style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
          <Sticker id={item.id} size={68} />
        </Pressable>
      )}
    />
  );
}

function GiphySearch({ type, onPick }: { type: 'gifs' | 'stickers'; onPick: (m: CommentMedia) => void }) {
  const isStickers = type === 'stickers';
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const results = useQuery({
    queryKey: ['giphy', type, query],
    queryFn: () => (isStickers ? searchStickers(query) : searchGifs(query)),
    enabled: giphyEnabled,
    staleTime: 5 * 60_000,
  });
  const columns = isStickers ? 4 : 3;
  const width = (useWindowDimensions().width - Spacing.three * 2 - Spacing.two * (columns - 1)) / columns;

  if (!giphyEnabled) {
    return (
      <AppText color={Colors.textSecondary} style={styles.note}>
        {isStickers ? 'More stickers' : 'GIFs'} aren&apos;t switched on yet. The GamePulse stickers work now.
      </AppText>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.search}>
        <Search size={16} color={Colors.textSecondary} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={isStickers ? 'Search stickers' : 'Search GIFs'}
          placeholderTextColor={Colors.textSecondary}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      {isStickers && (
        <FlatList
          horizontal
          data={STICKER_CATEGORIES}
          keyExtractor={(c) => c.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsBar}
          renderItem={({ item }) => {
            const on = item.query === text.trim();
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => setText(item.query)}
                style={[styles.chip, on && styles.chipOn]}>
                <AppText variant="label" color={on ? Colors.iceWhite : Colors.text}>
                  {item.label}
                </AppText>
              </Pressable>
            );
          }}
        />
      )}
      {results.isPending ? (
        <View style={styles.center}>
          <PulseLoader />
        </View>
      ) : results.isError ? (
        <AppText color={Colors.textSecondary} style={styles.note}>
          Couldn&apos;t load {isStickers ? 'stickers' : 'GIFs'}. Check your connection.
        </AppText>
      ) : (
        <FlatList
          key={type}
          data={results.data}
          keyExtractor={(g) => g.url}
          numColumns={columns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText color={Colors.textSecondary} style={styles.note}>
              Nothing for that. Try another word.
            </AppText>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isStickers ? 'Send sticker' : 'Send GIF'}
              onPress={() => onPick(item)}
              style={({ pressed }) => pressed && styles.pressed}>
              <Image
                source={item.url}
                style={isStickers ? { width, height: width } : [styles.gif, { width, height: width * 0.75 }]}
                contentFit={isStickers ? 'contain' : 'cover'}
                autoplay
              />
            </Pressable>
          )}
        />
      )}
      <AppText variant="label" color={Colors.textSecondary} style={styles.attribution}>
        Powered by GIPHY
      </AppText>
    </View>
  );
}
function SavedGrid({ onPick }: { onPick: (m: CommentMedia) => void }) {
  const saved = useSavedStickers();
  const width = (useWindowDimensions().width - Spacing.three * 2 - Spacing.two * 2) / 3;
  if (saved.isPending) {
    return (
      <View style={styles.center}>
        <PulseLoader />
      </View>
    );
  }
  return (
    <FlatList
      data={saved.data ?? []}
      keyExtractor={(m) => m.url}
      numColumns={3}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      ListEmptyComponent={
        <AppText color={Colors.textSecondary} style={styles.note}>
          Long-press any sticker or GIF in the comments to save it here.
        </AppText>
      }
      renderItem={({ item }) => {
        const own = item.url.startsWith('gp:');
        const sticker = own ? stickerFor(item.url) : null;
        return (
          <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => onPick(item)} style={[styles.savedCell, { width }]}>
            {own ? (
              <Sticker id={sticker?.id ?? item.url.slice(3)} size={Math.min(width - 12, 80)} />
            ) : item.kind === 'sticker' ? (
              <Image source={item.url} style={{ width: width - 8, height: width - 8 }} contentFit="contain" autoplay />
            ) : (
              <Image source={item.url} style={[styles.gif, { width, height: width * 0.75 }]} contentFit="cover" autoplay />
            )}
          </Pressable>
        );
      }}
    />
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}>
      <AppText variant="label" color={active ? Colors.primary : Colors.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: PICKER_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },
  tabs: { flexShrink: 0, flexDirection: 'row', paddingHorizontal: Spacing.three, gap: Spacing.two, paddingVertical: Spacing.two },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceMuted },
  grid: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
  row: { gap: Spacing.two },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.one },
  pressed: { opacity: 0.6, transform: [{ scale: 0.95 }] },
  savedCell: { alignItems: 'center', justifyContent: 'center', minHeight: 80 },
  gif: { borderRadius: Radius.sm, backgroundColor: Colors.surfaceMuted },
  search: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text, paddingVertical: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center', padding: Spacing.four },
  attribution: { textAlign: 'center', paddingVertical: 4 },
  // Fixed height: otherwise the grid below squeezes this row and cuts the chips in half.
  chipsBar: { flexGrow: 0, flexShrink: 0, height: 40, marginBottom: Spacing.two },
  chips: { paddingHorizontal: Spacing.three, gap: Spacing.two, alignItems: 'center' },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
