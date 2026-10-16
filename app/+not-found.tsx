import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useT } from '@/src/i18n/I18nProvider';

export default function NotFoundScreen() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('errors.oops') }} />
      <View style={styles.container}>
        <Text style={styles.title}>{t('errors.screenMissing')}</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t('errors.goHome')}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: '#2e78b7',
  },
});
