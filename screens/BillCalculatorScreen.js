import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toDateString, formatEntryDate, parseDateString, addDays } from '../utils/sales';

function DateNavigator({ label, date, onPrev, onNext }) {
  return (
    <View style={styles.dateBlock}>
      <Text style={styles.dateBlockLabel}>{label}</Text>
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.arrowBtn} onPress={onPrev} activeOpacity={0.7}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.dateValueWrap}>
          <Text style={styles.dateValue}>
            {date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity style={styles.arrowBtn} onPress={onNext} activeOpacity={0.7}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BillCalculatorScreen() {
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [pricePerJug, setPricePerJug] = useState('');

  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null); // { totalJugs, totalAmount, entries }

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingCustomers(false);
    });
    return unsub;
  }, []);

  const handleCalculate = async () => {
    if (!selectedCustomer) {
      Alert.alert('Select a customer', 'Please choose a customer first.');
      return;
    }
    const price = parseFloat(pricePerJug);
    if (!pricePerJug.trim() || isNaN(price) || price <= 0) {
      Alert.alert('Enter price', 'Please enter a valid price per jug.');
      return;
    }
    if (fromDate > toDate) {
      Alert.alert('Invalid dates', 'From date must be on or before To date.');
      return;
    }

    setCalculating(true);
    setResult(null);
    try {
      const fromStr = toDateString(fromDate);
      const toStr = toDateString(toDate);

      const snap = await getDocs(
        query(
          collection(db, 'customers', selectedCustomer.id, 'entries'),
          where('date', '>=', fromStr),
          where('date', '<=', toStr),
          orderBy('date', 'asc')
        )
      );

      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const totalJugs = entries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      const totalAmount = totalJugs * price;

      setResult({ totalJugs, totalAmount, entries, price });
    } catch (error) {
      Alert.alert('Error', 'Could not fetch entries. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const resetResult = () => setResult(null);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Customer selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Customer</Text>
          {loadingCustomers ? (
            <ActivityIndicator color="#2f6fed" style={{ marginTop: 8 }} />
          ) : (
            <TouchableOpacity
              style={styles.customerPicker}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.customerPickerText, !selectedCustomer && { color: '#99a7b3' }]}>
                {selectedCustomer ? selectedCustomer.name : 'Tap to select customer'}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date range */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Date Range</Text>
          <DateNavigator
            label="From"
            date={fromDate}
            onPrev={() => { setFromDate((d) => addDays(d, -1)); resetResult(); }}
            onNext={() => { setFromDate((d) => addDays(d, 1)); resetResult(); }}
          />
          <View style={styles.dateDivider} />
          <DateNavigator
            label="To"
            date={toDate}
            onPrev={() => { setToDate((d) => addDays(d, -1)); resetResult(); }}
            onNext={() => { setToDate((d) => addDays(d, 1)); resetResult(); }}
          />
        </View>

        {/* Price per jug */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Price per Jug (Rs)</Text>
          <TextInput
            style={styles.priceInput}
            value={pricePerJug}
            onChangeText={(text) => { setPricePerJug(text); resetResult(); }}
            placeholder="e.g. 80"
            placeholderTextColor="#99a7b3"
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>

        {/* Calculate button */}
        <TouchableOpacity
          style={[styles.calcButton, calculating && { opacity: 0.6 }]}
          onPress={handleCalculate}
          disabled={calculating}
          activeOpacity={0.85}
        >
          <Text style={styles.calcButtonText}>{calculating ? 'Calculating…' : 'Calculate Bill'}</Text>
        </TouchableOpacity>

        {/* Result card */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultCustomer}>{selectedCustomer.name}</Text>
            <Text style={styles.resultPeriod}>
              {fromDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              {'  →  '}
              {toDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>

            <View style={styles.resultRowsWrap}>
              <View style={styles.resultRow}>
                <Text style={styles.resultRowLabel}>Total Jugs Delivered</Text>
                <Text style={styles.resultRowValue}>{result.totalJugs}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultRowLabel}>Price per Jug</Text>
                <Text style={styles.resultRowValue}>Rs {parseFloat(pricePerJug).toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.totalWrap}>
              <Text style={styles.totalLabel}>Total Bill</Text>
              <Text style={styles.totalValue}>Rs {result.totalAmount.toLocaleString()}</Text>
            </View>

            {result.entries.length > 0 ? (
              <View style={styles.entriesWrap}>
                <Text style={styles.entriesTitle}>Delivery Log</Text>
                {result.entries.map((entry, index) => (
                  <View key={entry.id} style={[styles.entryRow, index === result.entries.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={styles.entryDate}>{formatEntryDate(entry.date)}</Text>
                    <Text style={styles.entryQty}>{entry.quantity} jugs</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noEntries}>No deliveries found in this date range.</Text>
            )}
          </View>
        )}

      </ScrollView>

      {/* Customer picker modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {customers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={[
                    styles.customerOption,
                    selectedCustomer?.id === customer.id && styles.customerOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedCustomer(customer);
                    setPickerVisible(false);
                    resetResult();
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.customerOptionText,
                    selectedCustomer?.id === customer.id && styles.customerOptionTextSelected,
                  ]}>
                    {customer.name}
                  </Text>
                  {selectedCustomer?.id === customer.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setPickerVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef4f8',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#0d2233',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7b9ab0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  customerPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f6fb',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  customerPickerText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#12344d',
    flex: 1,
  },
  pickerChevron: {
    fontSize: 26,
    color: '#2f6fed',
  },
  dateBlock: {
    marginBottom: 4,
  },
  dateBlockLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7b9ab0',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 32,
    color: '#12344d',
    marginTop: -2,
  },
  dateValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  dateValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#12344d',
  },
  dateDivider: {
    height: 1,
    backgroundColor: '#eef4f8',
    marginVertical: 14,
  },
  priceInput: {
    backgroundColor: '#f0f6fb',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '700',
    color: '#12344d',
  },
  calcButton: {
    backgroundColor: '#2f6fed',
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#2f6fed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  calcButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#12344d',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
  },
  resultCustomer: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  resultPeriod: {
    color: '#b8d4ea',
    fontSize: 16,
    marginBottom: 20,
  },
  resultRowsWrap: {
    backgroundColor: '#1d4c6f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultRowLabel: {
    color: '#b8d4ea',
    fontSize: 16,
  },
  resultRowValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  totalWrap: {
    backgroundColor: '#f7c948',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  totalLabel: {
    fontSize: 19,
    fontWeight: '700',
    color: '#3a2800',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3a2800',
  },
  entriesWrap: {
    backgroundColor: '#1d4c6f',
    borderRadius: 16,
    padding: 16,
  },
  entriesTitle: {
    color: '#9fc2de',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#24587e',
  },
  entryDate: {
    color: '#d4e4f0',
    fontSize: 16,
  },
  entryQty: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  noEntries: {
    color: '#9fc2de',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 16,
  },
  customerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#f5f8fb',
  },
  customerOptionSelected: {
    backgroundColor: '#dce8ff',
  },
  customerOptionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#12344d',
  },
  customerOptionTextSelected: {
    color: '#2f6fed',
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 22,
    color: '#2f6fed',
    fontWeight: '800',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 18,
    color: '#888',
  },
});
