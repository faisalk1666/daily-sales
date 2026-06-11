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
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  addDays,
  formatEntryDate,
  formatLongDate,
  formatMonthKey,
  getCurrentMonthKey,
  getMonthKeyFromDateString,
  normalizeDate,
  parseDateString,
  toDateString,
} from '../utils/sales';

export default function CustomerDetailScreen({ route, navigation }) {
  const { customerId, customerName: initialName } = route.params;
  const [name, setName] = useState(initialName);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editDate, setEditDate] = useState(normalizeDate(new Date()));
  const [editQuantity, setEditQuantity] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);
  const [entryDeleteVisible, setEntryDeleteVisible] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: name,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => { setNewName(name); setRenameVisible(true); }}
          style={{ marginRight: 16, padding: 8, borderRadius: 10, backgroundColor: '#eef4fc' }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, color: '#2f6fed', lineHeight: 20 }}>✎</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, name]);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a customer name.');
      return;
    }
    if (trimmed === name) {
      setRenameVisible(false);
      return;
    }
    setRenaming(true);
    try {
      await updateDoc(doc(db, 'customers', customerId), { name: trimmed });
      setName(trimmed);
      setRenameVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Could not rename customer. Please try again.');
    } finally {
      setRenaming(false);
    }
  };

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

  const customerName = name;
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

  const openEntryEditor = (entry) => {
    setSelectedEntry(entry);
    setEditDate(parseDateString(entry.date));
    setEditQuantity(String(entry.quantity ?? ''));
    setEntryModalVisible(true);
  };

  const closeEntryEditor = (force = false) => {
    if (savingEntry && !force) {
      return;
    }
    setEntryModalVisible(false);
    setEntryDeleteVisible(false);
    setSelectedEntry(null);
    setEditDate(normalizeDate(new Date()));
    setEditQuantity('');
  };

  const changeEditDay = (amount) => {
    const nextDate = addDays(editDate, amount);
    const today = normalizeDate(new Date());
    if (nextDate <= today) {
      setEditDate(nextDate);
    }
  };

  const handleSaveEntry = async () => {
    const quantityValue = parseInt(editQuantity, 10);
    if (!selectedEntry) {
      return;
    }

    if (!editQuantity.trim() || isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a valid number of jugs.');
      return;
    }

    setSavingEntry(true);
    try {
      const nextDateString = toDateString(editDate);
      const entryRef = doc(db, 'customers', customerId, 'entries', selectedEntry.id);

      if (nextDateString === selectedEntry.date) {
        await updateDoc(entryRef, {
          date: nextDateString,
          quantity: quantityValue,
        });
      } else {
        const entriesRef = collection(db, 'customers', customerId, 'entries');
        const matchingEntries = await getDocs(query(entriesRef, where('date', '==', nextDateString)));
        const batch = writeBatch(db);

        if (!matchingEntries.size) {
          batch.update(entryRef, {
            date: nextDateString,
            quantity: quantityValue,
          });
        } else {
          const targetEntry = matchingEntries.docs[0];
          const mergedQuantity = (Number(targetEntry.data().quantity) || 0) + quantityValue;
          batch.update(targetEntry.ref, {
            date: nextDateString,
            quantity: mergedQuantity,
          });
          batch.delete(entryRef);
        }

        await batch.commit();
      }

      closeEntryEditor(true);
    } catch (error) {
      Alert.alert('Update failed', 'Could not update this entry right now. Please try again.');
    } finally {
      setSavingEntry(false);
    }
  };

  const openDeleteEntryConfirm = () => {
    if (!selectedEntry || savingEntry) {
      return;
    }
    setEntryDeleteVisible(true);
  };

  const handleDeleteEntry = async () => {
    if (!selectedEntry) {
      return;
    }

    setDeletingEntry(true);
    try {
      await deleteDoc(doc(db, 'customers', customerId, 'entries', selectedEntry.id));
      closeEntryEditor(true);
    } catch (error) {
      Alert.alert('Delete failed', 'Could not delete this entry right now. Please try again.');
    } finally {
      setDeletingEntry(false);
      setEntryDeleteVisible(false);
    }
  };

  const renderEntry = (item, index, total) => (
    <View key={item.id} style={[styles.entryRow, index === total - 1 && styles.lastRow]}>
      <View style={styles.entryMain}>
        <Text style={styles.entryDate}>{formatEntryDate(item.date)}</Text>
        <Text style={styles.entryQty}>{item.quantity} jugs</Text>
      </View>
      <View style={styles.entryActions}>
        <TouchableOpacity style={styles.entryEditButton} onPress={() => openEntryEditor(item)} activeOpacity={0.8}>
          <Text style={styles.entryIconText}>✎</Text>
        </TouchableOpacity>
      </View>
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
        visible={renameVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !renaming && setRenameVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rename Customer</Text>
            <TextInput
              style={styles.confirmInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Customer name"
              placeholderTextColor="#91a3b0"
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />
            <TouchableOpacity
              style={[styles.modalPrimaryButton, renaming && { opacity: 0.6 }]}
              onPress={handleRename}
              disabled={renaming}
            >
              <Text style={styles.modalPrimaryButtonText}>{renaming ? 'Saving…' : 'Save Name'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setRenameVisible(false)}
              disabled={renaming}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      <Modal
        visible={entryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEntryEditor}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Entry</Text>
            <Text style={styles.modalText}>Change the delivery date or quantity. If you move it to a date that already exists, both entries will be merged.</Text>

            <Text style={styles.fieldLabel}>Date</Text>
            <View style={styles.editDateRow}>
              <TouchableOpacity style={styles.editArrowButton} onPress={() => changeEditDay(-1)}>
                <Text style={styles.editArrowText}>‹</Text>
              </TouchableOpacity>

              <View style={styles.editDateDisplay}>
                <Text style={styles.editDateText}>{formatLongDate(editDate)}</Text>
              </View>

              <TouchableOpacity
                style={[styles.editArrowButton, toDateString(editDate) === toDateString(normalizeDate(new Date())) && styles.editArrowDisabled]}
                onPress={() => changeEditDay(1)}
                disabled={toDateString(editDate) === toDateString(normalizeDate(new Date()))}
              >
                <Text
                  style={[
                    styles.editArrowText,
                    toDateString(editDate) === toDateString(normalizeDate(new Date())) && styles.editArrowTextDisabled,
                  ]}
                >
                  ›
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Number of Jugs</Text>
            <TextInput
              style={styles.confirmInput}
              value={editQuantity}
              onChangeText={setEditQuantity}
              placeholder="e.g. 5"
              placeholderTextColor="#91a3b0"
              keyboardType="number-pad"
              maxLength={5}
            />

            <TouchableOpacity
              style={[styles.modalPrimaryButton, savingEntry && { opacity: 0.6 }]}
              onPress={handleSaveEntry}
              disabled={savingEntry}
            >
              <Text style={styles.modalPrimaryButtonText}>{savingEntry ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalDeleteButton, (savingEntry || deletingEntry) && { opacity: 0.6 }]}
              onPress={openDeleteEntryConfirm}
              disabled={savingEntry || deletingEntry}
            >
              <Text style={styles.modalDeleteButtonText}>Delete Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelButton} onPress={closeEntryEditor}>
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={entryDeleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deletingEntry && setEntryDeleteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.modalTitle}>Delete Entry</Text>
            <Text style={styles.modalText}>
              {selectedEntry
                ? `${formatEntryDate(selectedEntry.date)} • ${selectedEntry.quantity} jugs will be removed.`
                : 'This entry will be removed.'}
            </Text>
            <TouchableOpacity
              style={[styles.modalDeleteButton, deletingEntry && { opacity: 0.6 }]}
              onPress={handleDeleteEntry}
              disabled={deletingEntry}
            >
              <Text style={styles.modalDeleteButtonText}>{deletingEntry ? 'Deleting…' : 'Confirm Delete'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setEntryDeleteVisible(false)}
              disabled={deletingEntry}
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
    backgroundColor: '#f2f6fa',
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
  entryMain: {
    flex: 1,
    marginRight: 12,
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
    marginTop: 6,
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryEditButton: {
    width: 42,
    height: 42,
    backgroundColor: '#e7f0ff',
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryIconText: {
    fontSize: 18,
    lineHeight: 20,
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
  confirmSheet: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    paddingBottom: 28,
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
  fieldLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#12344d',
    marginBottom: 10,
  },
  editDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  editArrowButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf4fb',
  },
  editArrowDisabled: {
    backgroundColor: '#f3f5f7',
  },
  editArrowText: {
    fontSize: 30,
    lineHeight: 32,
    color: '#2f6fed',
  },
  editArrowTextDisabled: {
    color: '#b8c3cc',
  },
  editDateDisplay: {
    flex: 1,
    marginHorizontal: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f8fbff',
    borderWidth: 1.5,
    borderColor: '#d8e2ea',
  },
  editDateText: {
    fontSize: 18,
    color: '#12344d',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalPrimaryButton: {
    backgroundColor: '#2f6fed',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
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
