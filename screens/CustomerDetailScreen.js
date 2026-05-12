import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  writeBatch,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  formatEntryDate,
  formatMonthKey,
  getCurrentMonthKey,
  getMonthKeyFromDateString,
} from '../utils/sales';

export default function CustomerDetailScreen({ route, navigation }) {
  const { customerId, customerName } = route.params;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: customerName });
  }, [navigation, customerName]);

  useEffect(() => {
    const customerEntriesQuery = query(
      collection(db, 'customers', customerId, 'entries'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(customerEntriesQuery, (snapshot) => {
      const list = snapshot.docs.map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() }));
      setEntries(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [customerId]);

  const totalQty = entries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
  const currentMonthKey = getCurrentMonthKey();
  const currentMonthEntries = entries.filter((entry) => getMonthKeyFromDateString(entry.date) === currentMonthKey);
  const currentMonthTotal = currentMonthEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);

  const archiveGroups = Object.entries(
    entries
      .filter((entry) => getMonthKeyFromDateString(entry.date) !== currentMonthKey)
      .reduce((groups, entry) => {
        const monthKey = getMonthKeyFromDateString(entry.date);
        if (!groups[monthKey]) {
          groups[monthKey] = [];
        }
        groups[monthKey].push(entry);
        return groups;
      }, {})
  )
    .sort(([leftMonth], [rightMonth]) => rightMonth.localeCompare(leftMonth))
    .map(([monthKey, monthEntries]) => ({
      monthKey,
      label: formatMonthKey(monthKey),
      total: monthEntries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0),
      count: monthEntries.length,
      entries: monthEntries,
    }));

  const toggleMonth = (monthKey) => {
    setExpandedMonths((currentState) => ({
      ...currentState,
      [monthKey]: !currentState[monthKey],
    }));
  };

  const handleDeleteCustomer = async () => {
    if (confirmName.trim().toLowerCase() !== customerName.trim().toLowerCase()) {
      Alert.alert('Name does not match', 'Type the exact customer name before deleting.');
      return;
    }

    setDeleting(true);
    try {
      const entriesSnapshot = await getDocs(collection(db, 'customers', customerId, 'entries'));
      for (let index = 0; index < entriesSnapshot.docs.length; index += 400) {
        const batch = writeBatch(db);
        entriesSnapshot.docs.slice(index, index + 400).forEach((entryDoc) => {
          batch.delete(entryDoc.ref);
        });
        await batch.commit();
      }

      await deleteDoc(doc(db, 'customers', customerId));
      setDeleteVisible(false);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Delete failed', 'Could not delete the customer right now. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const renderEntry = (item, index, total) => (
    <View key={item.id} style={[styles.entryRow, index === total - 1 && styles.lastRow]}>
      <Text style={styles.entryDate}>{formatEntryDate(item.date)}</Text>
      <Text style={styles.entryQty}>{item.quantity} jugs</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2f6fed" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroCard}>
            <Text style={styles.customerName}>{customerName}</Text>
            <Text style={styles.customerHint}>Current month is shown first. Older months stay in archive below.</Text>

            <View style={styles.statsRow}>
              <View style={styles.statCardDark}>
                <Text style={styles.statLabelDark}>All Time</Text>
                <Text style={styles.statValueDark}>{totalQty}</Text>
                <Text style={styles.statFootDark}>jugs sold</Text>
              </View>
              <View style={styles.statCardLight}>
                <Text style={styles.statLabelLight}>{formatMonthKey(currentMonthKey)}</Text>
                <Text style={styles.statValueLight}>{currentMonthTotal}</Text>
                <Text style={styles.statFootLight}>this month</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddEntry', { customerId, customerName })}
              activeOpacity={0.85}
            >
              <Text style={styles.addButtonText}>+ Add Sales Entry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setDeleteVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{formatMonthKey(currentMonthKey)}</Text>
              <Text style={styles.sectionMeta}>{currentMonthEntries.length} entries</Text>
            </View>
            {currentMonthEntries.length ? (
              currentMonthEntries.map((entry, index) => renderEntry(entry, index, currentMonthEntries.length))
            ) : (
              <Text style={styles.emptyText}>No entries this month yet. Use “Add Sales Entry” to record deliveries.</Text>
            )}
          </View>

          <View style={styles.archiveHeaderRow}>
            <Text style={styles.archiveTitle}>Archive</Text>
            <Text style={styles.archiveSubtext}>Previous months stay grouped here.</Text>
          </View>

          {archiveGroups.length ? (
            archiveGroups.map((group) => {
              const isExpanded = !!expandedMonths[group.monthKey];
              return (
                <View key={group.monthKey} style={styles.archiveCard}>
                  <TouchableOpacity style={styles.archiveButton} onPress={() => toggleMonth(group.monthKey)} activeOpacity={0.82}>
                    <View>
                      <Text style={styles.archiveMonth}>{group.label}</Text>
                      <Text style={styles.archiveMeta}>{group.count} entries</Text>
                    </View>
                    <View style={styles.archiveRight}>
                      <Text style={styles.archiveTotal}>{group.total} jugs</Text>
                      <Text style={styles.archiveChevron}>{isExpanded ? '−' : '+'}</Text>
                    </View>
                  </TouchableOpacity>
                  {isExpanded ? group.entries.map((entry, index) => renderEntry(entry, index, group.entries.length)) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.archiveEmptyCard}>
              <Text style={styles.archiveEmptyText}>No archived months yet.</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={deleteVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Delete Customer</Text>
            <Text style={styles.modalText}>
              This removes the customer and all sales entries. For safety, type the customer name exactly.
            </Text>
            <Text style={styles.confirmName}>{customerName}</Text>

            <TextInput
              style={styles.confirmInput}
              value={confirmName}
              onChangeText={setConfirmName}
              placeholder="Type customer name"
              placeholderTextColor="#91a3b0"
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={[styles.modalDeleteButton, deleting && { opacity: 0.6 }]}
              onPress={handleDeleteCustomer}
              disabled={deleting}
            >
              <Text style={styles.modalDeleteButtonText}>{deleting ? 'Deleting…' : 'Delete Customer'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setDeleteVisible(false);
                setConfirmName('');
              }}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef4f8',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: '#12344d',
    borderRadius: 26,
    padding: 22,
    marginBottom: 14,
  },
  customerName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  customerHint: {
    marginTop: 8,
    color: '#d4e4f0',
    fontSize: 16,
    lineHeight: 23,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  statCardDark: {
    flex: 1,
    backgroundColor: '#1d4c6f',
    borderRadius: 18,
    padding: 16,
    marginRight: 8,
  },
  statCardLight: {
    flex: 1,
    backgroundColor: '#f7fbff',
    borderRadius: 18,
    padding: 16,
    marginLeft: 8,
  },
  statLabelDark: {
    color: '#c6deef',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  statValueDark: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
  },
  statFootDark: {
    color: '#c6deef',
    fontSize: 14,
    marginTop: 4,
  },
  statLabelLight: {
    color: '#5f7587',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  statValueLight: {
    color: '#12344d',
    fontSize: 34,
    fontWeight: '800',
  },
  statFootLight: {
    color: '#6f8291',
    fontSize: 14,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#2f6fed',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginRight: 8,
    elevation: 3,
    shadowColor: '#2f6fed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  deleteButton: {
    width: 106,
    backgroundColor: '#ffe8e5',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#c94a37',
    fontSize: 17,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#0d2233',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#12344d',
  },
  sectionMeta: {
    fontSize: 15,
    color: '#6f8291',
  },
  entryRow: {
    backgroundColor: '#f7fbff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  lastRow: {
    marginBottom: 0,
  },
  entryDate: {
    fontSize: 18,
    color: '#243845',
    fontWeight: '600',
  },
  entryQty: {
    fontSize: 18,
    color: '#2f6fed',
    fontWeight: '800',
  },
  archiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  archiveTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#12344d',
  },
  archiveSubtext: {
    fontSize: 14,
    color: '#6f8291',
  },
  archiveCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  archiveButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archiveMonth: {
    fontSize: 20,
    fontWeight: '800',
    color: '#12344d',
  },
  archiveMeta: {
    marginTop: 4,
    fontSize: 15,
    color: '#738796',
  },
  archiveRight: {
    alignItems: 'flex-end',
  },
  archiveTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e7b4d',
  },
  archiveChevron: {
    marginTop: 2,
    fontSize: 28,
    color: '#2f6fed',
    lineHeight: 30,
  },
  archiveEmptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
  },
  archiveEmptyText: {
    fontSize: 16,
    color: '#738796',
  },
  emptyText: {
    fontSize: 16,
    color: '#6f8291',
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: '#12344d',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#637787',
    marginBottom: 12,
  },
  confirmName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#c94a37',
    marginBottom: 14,
  },
  confirmInput: {
    borderWidth: 1.5,
    borderColor: '#d8e2ea',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 18,
    color: '#12344d',
    marginBottom: 16,
    backgroundColor: '#f8fbff',
  },
  modalDeleteButton: {
    backgroundColor: '#c94a37',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalDeleteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalCancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelButtonText: {
    color: '#6f8291',
    fontSize: 17,
    fontWeight: '600',
  },
});
