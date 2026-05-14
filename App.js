// App.js
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import CustomerListScreen from './screens/CustomerListScreen';
import CustomerDetailScreen from './screens/CustomerDetailScreen';
import AddEntryScreen from './screens/AddEntryScreen';
import BillCalculatorScreen from './screens/BillCalculatorScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#f8fbff' },
          headerTintColor: '#12344d',
          headerTitleStyle: { fontWeight: '700', fontSize: 20 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#eef4f8' },
        }}
      >
        <Stack.Screen
          name="CustomerList"
          component={CustomerListScreen}
          options={{ title: 'New Kabir Aqua' }}
        />
        <Stack.Screen
          name="CustomerDetail"
          component={CustomerDetailScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="AddEntry"
          component={AddEntryScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="BillCalculator"
          component={BillCalculatorScreen}
          options={{ title: 'Bill Calculator' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
