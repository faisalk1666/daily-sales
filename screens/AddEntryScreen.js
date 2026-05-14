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
import { addDays, formatLongDate, getLastNDates, normalizeDate, saveOrMergeEntry, toDateString } from '../utils/sales';

export default function AddEntryScreen({ route, navigation }) {
  const { customerId, customerName } = route.params;
  const today = normalizeDate(new Date());
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState('single');
  const [batchDays, setBatchDays] = useState('3');
  const [quantity, setQuantity] = useState('');
  const [recentQuantities, setRecentQuantities] = useState({});
  const [saving, setSaving] = useState(false);
  const batchCount = Math.min(Math.max(parseInt(batchDays, 10) || 0, 1), 14);
  const recentDates = getLastNDates(batchCount, today);

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
      if (mode === 'single') {
        const qty = parseInt(quantity, 10);
        if (!quantity.trim() || isNaN(qty) || qty <= 0) {
          Alert.alert('Invalid quantity', 'Please enter a valid number of jugs (e.g. 5).');
          setSaving(false);
          return;
        }

        await saveOrMergeEntry(db, customerId, toDateString(date), qty);
      } else {
        if (!batchDays.trim() || isNaN(parseInt(batchDays, 10)) || parseInt(batchDays, 10) <= 0) {
          Alert.alert('Invalid day range', 'Enter how many recent days you want to add, for example 7.');
          setSaving(false);
          return;
        }

        const payload = recentDates
          .map((recentDate) => ({
            dateString: toDateString(recentDate),
            quantityValue: parseInt(recentQuantities[toDateString(recentDate)] || '', 10),
          }))
          .filter((item) => !isNaN(item.quantityValue) && item.quantityValue > 0);

        if (!payload.length) {
          Alert.alert('No quantities entered', 'Add at least one quantity in the last 3 days section.');
          setSaving(false);
          return;
        }

        for (const item of payload) {
          await saveOrMergeEntry(db, customerId, item.dateString, item.quantityValue);
        }
      }

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
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Quick sales entry</Text>
          <Text style={styles.heroText}>Use one day for a single update, or fill the last 3 days in one save.</Text>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'single' && styles.modeButtonActive]}
            onPress={() => setMode('single')}
          >
            <Text style={[styles.modeButtonText, mode === 'single' && styles.modeButtonTextActive]}>Single Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'last3' && styles.modeButtonActive]}
            onPress={() => setMode('last3')}
          >
            <Text style={[styles.modeButtonText, mode === 'last3' && styles.modeButtonTextActive]}>Last x Days</Text>
          </TouchableOpacity>
        </View>

        {mode === 'single' ? (
          <>
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
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Recent Days</Text>
            <Text style={styles.batchHint}>Choose the last X days you want to fill. Leave a box empty if there was no delivery.</Text>
            <View style={styles.rangeCard}>
              <Text style={styles.rangeLabel}>How many recent days?</Text>
              <TextInput
                style={styles.rangeInput}
                placeholder="3"
                placeholderTextColor="#9aa8b3"
                value={batchDays}
                onChangeText={setBatchDays}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.rangeHint}>You can enter 1 to 14 days.</Text>
            </View>
            {recentDates.map((recentDate) => {
              const dateString = toDateString(recentDate);
              return (
                <View key={dateString} style={styles.batchCard}>
                  <View style={styles.batchCardHeader}>
                    <Text style={styles.batchDate}>{formatLongDate(recentDate)}</Text>
                    {dateString === toDateString(today) ? <Text style={styles.todayBadge}>Today</Text> : null}
                  </View>
                  <TextInput
                    style={styles.batchInput}
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    value={recentQuantities[dateString] || ''}
                    onChangeText={(value) => {
                      setRecentQuantities((currentState) => ({
                        ...currentState,
                        [dateString]: value,
                      }));
                    }}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              );
            })}
          </>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : mode === 'single' ? 'Save Entry' : `Save Last ${batchCount} Days`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#eef4f8',
    padding: 24,
  },
  heroCard: {
    backgroundColor: '#12344d',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroText: {
    color: '#d7e5ef',
    fontSize: 16,
    lineHeight: 23,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#dfe9f0',
    borderRadius: 18,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#fff',
  },
  modeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6b7f8f',
  },
  modeButtonTextActive: {
    color: '#12344d',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
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
  batchHint: {
    fontSize: 15,
    color: '#6f8291',
    marginBottom: 12,
    lineHeight: 22,
  },
  rangeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  rangeLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#12344d',
    marginBottom: 10,
  },
  rangeInput: {
    backgroundColor: '#f7fbff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#12344d',
    textAlign: 'center',
    marginBottom: 8,
  },
  rangeHint: {
    fontSize: 14,
    color: '#6f8291',
  },
  batchCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  batchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#12344d',
  },
  batchInput: {
    backgroundColor: '#f7fbff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 26,
    fontWeight: '700',
    color: '#12344d',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 28,
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
