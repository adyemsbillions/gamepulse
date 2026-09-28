import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Bell, Compass, House, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Colors, Radius, TabBarHeight } from '@/constants/theme';
import { useNotifications } from '@/lib/queries';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Reels', icon: House },
  discover: { label: 'Discover', icon: Compass },
  create: { label: 'Create', icon: Plus },
  notifications: { label: 'Alerts', icon: Bell },
  profile: { label: 'Profile', icon: UserRound },
};

/** Lucide-based tab bar. Goes dark on the Reels tab so it blends with full-screen video. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const onReels = state.routes[state.index]?.name === 'index';
  const bg = onReels ? Colors.primaryDeep : Colors.surface;
  const idle = onReels ? Colors.powderBlue : Colors.textSecondary;
  const activeColor = onReels ? Colors.iceWhite : Colors.primary;
  const unread = useNotifications().data?.filter((n) => !n.read).length ?? 0;

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: bg, paddingBottom: insets.bottom, height: TabBarHeight + insets.bottom },
        !onReels && styles.border,
      ]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const Icon = tab.icon;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (route.name === 'create') {
          return (
            <Pressable key={route.key} accessibilityLabel="Create a Moment" onPress={onPress} style={styles.item}>
              <View style={[styles.create, onReels && styles.createOnDark]}>
                <Icon size={24} color={onReels ? Colors.primary : Colors.iceWhite} strokeWidth={2.5} />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={onPress}
            style={styles.item}>
            <View>
              <Icon size={24} color={focused ? activeColor : idle} strokeWidth={focused ? 2.4 : 1.9} />
              {route.name === 'notifications' && unread > 0 && (
                <View style={[styles.dot, { backgroundColor: onReels ? Colors.pulse : Colors.danger }]} />
              )}
            </View>
            <AppText variant="label" color={focused ? activeColor : idle}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: TabBarHeight },
  create: {
    width: 52,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createOnDark: { backgroundColor: Colors.iceWhite },
  dot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});
