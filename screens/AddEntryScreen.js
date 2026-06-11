// screens/AddEntryScreen.js
import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { db } from '../firebase';
import { addDays, formatLongDate, normalizeDate, saveOrMergeEntry, toDateString } from '../utils/sales';

export default function AddEntryScreen({ route, navigation }) {
  const { customerId, customerName } = route.params;
  const today = normalizeDate(new Date());
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Add Entry — ${customerName}` });
  }, [navigation, customerName]);

  const changeDay = (n) => {
    const next = addDays(date, n);
    if (next <= today) setDate(next);
  };

  const isToday = toDateString(date) === toDateString(today);

  const handleSave = async () => {
    setSaving(true);
    try {
      const qty = parseInt(quantity, 10);
      if (!quantity.trim() || isNaN(qty) || qty <= 0) {
        Alert.alert('Invalid quantity', 'Please enter a valid number of jugs (e.g. 5).');
        setSaving(false);
        return;
      }
      await saveOrMergeEntry(db, customerId, toDateString(date), qty);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save entry. Please try again.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Date</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => changeDay(-1)}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.dateMid}>
            <Text style={styles.dateText}>{formatLongDate(date)}</Text>
            {isToday && <Text style={styles.todayBadge}>Today</Text>}
          </View>

          <TouchableOpacity
            style={[styles.arrowBtn, isToday && styles.arrowDisabled]}
            onPress={() => changeDay(1)}
            disabled={isToday}
          >
            <Text style={[styles.arrowText, isToday && { color: '#ccc' }]}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { marginTop: 28 }]}>Number of Jugs</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 5"
          placeholderTextColor="#bbb"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          maxLength={5}
          returnKeyType="done"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Entry'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f2f6fa',
    padding: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7b9ab0',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  arrowBtn: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    fontSize: 36,
    color: '#2f6fed',
    lineHeight: 40,
  },
  dateMid: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  dateText: {
    fontSize: 19,
    fontWeight: '600',
    color: '#1c1c1e',
    textAlign: 'center',
  },
  todayBadge: {
    marginTop: 4,
    fontSize: 13,
    color: '#2f6fed',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 32,
    fontWeight: '600',
    color: '#1c1c1e',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#2f6fed',
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 40,
    elevation: 4,
    shadowColor: '#2f6fed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
});
