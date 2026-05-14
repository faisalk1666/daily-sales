import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { addDays, formatLongDate, normalizeDate, saveOrMergeEntry, toDateString } from '../utils/sales';

export default function BatchCustomerEntryScreen({ navigation }) {
  const today = normalizeDate(new Date());
  const [date, setDate] = useState(today);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState({});
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Batch Entry' });
  }, [navigation]);

  useEffect(() => {
    const customersQuery = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(customersQuery, (snapshot) => {
      const nextCustomers = snapshot.docs.map((customerDoc) => ({
        id: customerDoc.id,
        ...customerDoc.data(),
      }));
      setCustomers(nextCustomers);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const changeDay = (amount) => {
    const nextDate = addDays(date, amount);
    if (nextDate <= today) {
      setDate(nextDate);
    }
  };

  const isToday = toDateString(date) === toDateString(today);

  const filteredCustomers = searchQuery.trim()
    ? customers.filter((customer) => customer.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : customers;

  const selectedCount = Object.values(selectedCustomers).filter(Boolean).length;

  const toggleCustomer = (customerId) => {
    setSelectedCustomers((currentState) => ({
      ...currentState,
      [customerId]: !currentState[customerId],
    }));
  };

  const handleQuantityChange = (customerId, value) => {
    setQuantities((currentState) => ({
      ...currentState,
      [customerId]: value,
    }));
  };

  const handleSave = async () => {
    const activeCustomers = customers.filter((customer) => selectedCustomers[customer.id]);

    if (!activeCustomers.length) {
      Alert.alert('Select customers', 'Choose at least one customer for this batch entry.');
      return;
    }

    const invalidCustomer = activeCustomers.find((customer) => {
      const quantityValue = parseInt(quantities[customer.id] || '', 10);
      return Number.isNaN(quantityValue) || quantityValue <= 0;
    });

    if (invalidCustomer) {
      Alert.alert('Invalid quantity', `Enter a valid jug quantity for ${invalidCustomer.name}.`);
      return;
    }

    setSaving(true);
    try {
      const dateString = toDateString(date);
      for (const customer of activeCustomers) {
        await saveOrMergeEntry(db, customer.id, dateString, parseInt(quantities[customer.id], 10));
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', 'Could not save batch entries right now. Please try again.');
      setSaving(false);
    }
  };

  const renderCustomerRow = (customer) => {
    const isSelected = !!selectedCustomers[customer.id];
    return (
      <TouchableOpacity
        key={customer.id}
        style={[styles.customerCard, isSelected && styles.customerCardSelected]}
        onPress={() => toggleCustomer(customer.id)}
        activeOpacity={0.82}
      >
        <View style={styles.customerTopRow}>
          <View style={styles.customerTextWrap}>
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.customerHint}>{isSelected ? 'Selected for this date' : 'Tap to include in this batch'}</Text>
          </View>
          <View style={[styles.selectBadge, isSelected && styles.selectBadgeActive]}>
            <Text style={[styles.selectBadgeText, isSelected && styles.selectBadgeTextActive]}>{isSelected ? 'Selected' : 'Select'}</Text>
          </View>
        </View>

        {isSelected ? (
          <View style={styles.quantityWrap}>
            <Text style={styles.quantityLabel}>Jugs for {formatLongDate(date)}</Text>
            <TextInput
              style={styles.quantityInput}
              value={quantities[customer.id] || ''}
              onChangeText={(value) => handleQuantityChange(customer.id, value)}
              placeholder="e.g. 3"
              placeholderTextColor="#99a7b3"
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Batch customer entry</Text>
          <Text style={styles.heroText}>Pick one date, select multiple customers, then enter jug quantities for each selected customer.</Text>
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.sectionLabel}>Date</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.arrowButton} onPress={() => changeDay(-1)}>
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.dateDisplay}>
              <Text style={styles.dateText}>{formatLongDate(date)}</Text>
              {isToday ? <Text style={styles.todayBadge}>Today</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.arrowButton, isToday && styles.arrowButtonDisabled]}
              onPress={() => changeDay(1)}
              disabled={isToday}
            >
              <Text style={[styles.arrowText, isToday && styles.arrowTextDisabled]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search customers..."
            placeholderTextColor="#99a7b3"
            returnKeyType="search"
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryTitle}>Selected customers</Text>
          <Text style={styles.summaryCount}>{selectedCount}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2f6fed" style={{ marginTop: 40 }} />
        ) : filteredCustomers.length ? (
          filteredCustomers.map(renderCustomerRow)
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No customers found</Text>
            <Text style={styles.emptyText}>Try a different search or add a new customer from the home screen.</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving || loading}
          activeOpacity={0.84}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : `Save Batch for ${selectedCount} Customer${selectedCount === 1 ? '' : 's'}`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#eef4f8',
    padding: 20,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: '#12344d',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroText: {
    color: '#d7e5ef',
    fontSize: 16,
    lineHeight: 24,
  },
  dateCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 16,
    color: '#607484',
    fontWeight: '700',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#edf4fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: {
    backgroundColor: '#f3f5f7',
  },
  arrowText: {
    fontSize: 30,
    lineHeight: 30,
    color: '#2f6fed',
  },
  arrowTextDisabled: {
    color: '#b8c3cc',
  },
  dateDisplay: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f8fbff',
    borderWidth: 1.5,
    borderColor: '#d8e2ea',
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#12344d',
    textAlign: 'center',
  },
  todayBadge: {
    marginTop: 8,
    backgroundColor: '#e7f0ff',
    color: '#2f6fed',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  searchInput: {
    paddingVertical: 16,
    fontSize: 18,
    color: '#12344d',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#12344d',
  },
  summaryCount: {
    minWidth: 40,
    textAlign: 'center',
    backgroundColor: '#dce8ff',
    color: '#2f6fed',
    fontSize: 18,
    fontWeight: '800',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  customerCardSelected: {
    borderColor: '#2f6fed',
    backgroundColor: '#f7fbff',
  },
  customerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10212f',
  },
  customerHint: {
    marginTop: 5,
    fontSize: 15,
    color: '#6f8291',
  },
  selectBadge: {
    backgroundColor: '#eef3f8',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectBadgeActive: {
    backgroundColor: '#dce8ff',
  },
  selectBadgeText: {
    color: '#607484',
    fontSize: 14,
    fontWeight: '700',
  },
  selectBadgeTextActive: {
    color: '#2f6fed',
  },
  quantityWrap: {
    marginTop: 16,
  },
  quantityLabel: {
    fontSize: 15,
    color: '#607484',
    fontWeight: '700',
    marginBottom: 10,
  },
  quantityInput: {
    borderWidth: 1.5,
    borderColor: '#d8e2ea',
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 19,
    color: '#12344d',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#12344d',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6f8291',
    lineHeight: 24,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: '#2f6fed',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700',
  },
});
