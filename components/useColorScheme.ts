import { useColorScheme as useColorSchemeCore } from 'react-native';

/** Normalize RN color scheme for template Themed helpers. */
export const useColorScheme = (): 'light' | 'dark' => {
  const coreScheme = useColorSchemeCore();
  return coreScheme === 'dark' ? 'dark' : 'light';
};
