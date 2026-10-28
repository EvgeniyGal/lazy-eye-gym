import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/src/i18n/I18nProvider';
import { useColors } from '@/src/theme/ThemeProvider';

const TAB_BAR_CONTENT = 56;
const TAB_BAR_PAD_TOP = 8;
const TAB_BAR_PAD_BOTTOM_MIN = 8;

export default function TabLayout() {
  const { t } = useT();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabPadBottom = TAB_BAR_PAD_BOTTOM_MIN + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceLowest,
          borderTopColor: colors.outlineVariant,
          height: TAB_BAR_CONTENT + TAB_BAR_PAD_TOP + tabPadBottom,
          paddingBottom: tabPadBottom,
          paddingTop: TAB_BAR_PAD_TOP,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: t('tabs.games'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller-outline" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="guide"
        options={{
          title: t('tabs.guide'),
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
