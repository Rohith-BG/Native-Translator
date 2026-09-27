import { Tabs } from 'expo-router';
import { Camera, FileText, Mic, Type } from 'lucide-react-native';
import { Platform } from 'react-native';

import { darkTheme } from '@/constants/theme';

const TabLayout = () => {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#101018',
          borderTopColor: darkTheme.surfaceBorder,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 84 : 68,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          elevation: 0,
        },
        tabBarActiveTintColor: darkTheme.primary,
        tabBarInactiveTintColor: darkTheme.textMuted,
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          letterSpacing: 0.1,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="text"
        options={{
          title: 'Text',
          tabBarIcon: ({ color, size }) => <Type color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice',
          tabBarIcon: ({ color, size }) => <Mic color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, size }) => <Camera color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="document"
        options={{
          title: 'Docs',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size - 2} />,
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
