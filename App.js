// App.js
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import CustomerListScreen from './screens/CustomerListScreen';
import CustomerDetailScreen from './screens/CustomerDetailScreen';
import AddEntryScreen from './screens/AddEntryScreen';
import BillCalculatorScreen from './screens/BillCalculatorScreen';
import BatchCustomerEntryScreen from './screens/BatchCustomerEntryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const stackOptions = {
  headerStyle: { backgroundColor: '#ffffff' },
  headerTintColor: '#12344d',
  headerTitleStyle: { fontWeight: '700', fontSize: 18 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: '#f2f6fa' },
};

function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="CustomerList" component={CustomerListScreen} options={{ title: 'Customers' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}

function TodayStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="BatchCustomerEntry" component={BatchCustomerEntryScreen} options={{ title: "Today's Entry" }} />
    </Stack.Navigator>
  );
}

function BillsStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="BillCalculator" component={BillCalculatorScreen} options={{ title: 'Bill Calculator' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#2f6fed',
          tabBarInactiveTintColor: '#9aabb8',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#e8eef4',
            borderTopWidth: 1,
            paddingBottom: 8,
            paddingTop: 6,
            height: 64,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          tabBarIcon: ({ focused, color }) => {
            let iconName;
            if (route.name === 'CustomersTab') iconName = focused ? 'people' : 'people-outline';
            else if (route.name === 'TodayTab') iconName = focused ? 'add-circle' : 'add-circle-outline';
            else if (route.name === 'BillsTab') iconName = focused ? 'receipt' : 'receipt-outline';
            return <Ionicons name={iconName} size={24} color={color} />;
          },
        })}
      >
        <Tab.Screen name="CustomersTab" component={CustomersStack} options={{ title: 'Customers' }} />
        <Tab.Screen name="TodayTab" component={TodayStack} options={{ title: 'Today' }} />
        <Tab.Screen name="BillsTab" component={BillsStack} options={{ title: 'Bills' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
