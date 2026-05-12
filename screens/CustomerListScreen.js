import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  collection,
  onSnapshot,
  addDoc,
  query,
  orderBy,
  getDocs,
  where,
} from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db } from '../firebase';
import {
  buildMonthlySalesCsv,
  formatMonthKey,
  getMonthKeyFromDate,
  getNextMonthKey,
} from '../utils/sales';

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function CustomerListScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMonth, setExportMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCustomers(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleAddCustomer = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a customer name.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'customers'), { name: trimmed });
      setNewName('');
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Could not add customer. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const moveExportMonth = (amount) => {
    setExportMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1));
  };

  const handleExportMonth = async () => {
    if (!customers.length) {
      Alert.alert('Nothing to export', 'Add a customer first, then export monthly sales.');
      return;
    }

    setExporting(true);
    try {
      const monthKey = getMonthKeyFromDate(exportMonth);
      const nextMonthKey = getNextMonthKey(monthKey);
      const rows = await Promise.all(
        customers.map(async (customer) => {
          const monthlyEntries = await getDocs(
            query(
              collection(db, 'customers', customer.id, 'entries'),
              where('date', '>=', `${monthKey}-01`),
              where('date', 'lt', `${nextMonthKey}-01`)
            )
          );

          return {
            name: customer.name,
            entriesCount: monthlyEntries.size,
            totalQuantity: monthlyEntries.docs.reduce((sum, entryDoc) => {
              return sum + (Number(entryDoc.data().quantity) || 0);
            }, 0),
          };
        })
      );

      const activeRows = rows
        .filter((row) => row.totalQuantity > 0)
        .sort((left, right) => right.totalQuantity - left.totalQuantity || left.name.localeCompare(right.name));

      if (!activeRows.length) {
        Alert.alert('No sales found', `No sales were recorded in ${formatMonthKey(monthKey)}.`);
        return;
      }

      const csv = buildMonthlySalesCsv({
        monthLabel: formatMonthKey(monthKey),
        rows: activeRows,
      });
      const filename = `kabir-aqua-sales-${monthKey}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: `${formatMonthKey(monthKey)} sales export`,
          });
        } else {
          Alert.alert('Export saved', `The file was saved to ${fileUri}`);
        }
      }

      setExportVisible(false);
    } catch (error) {
      Alert.alert('Export failed', 'Could not export monthly sales. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const renderCustomer = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id, customerName: item.name })}
      activeOpacity={0.78}
    >
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>{item.name}</Text>
          <Text style={styles.cardHint}>Open customer notebook</Text>
        </View>
      </View>
      <View style={styles.cardArrowWrap}>
        <Text style={styles.cardArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const listHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.heroCard}>
        <View>
          <Text style={styles.heroLabel}>Customer Ledger</Text>
          <Text style={styles.heroTitle}>Simple monthly tracking</Text>
          <Text style={styles.heroSubtext}>Large cards, quick export, easy updates.</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countNumber}>{customers.length}</Text>
          <Text style={styles.countLabel}>customers</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.exportButton} onPress={() => setExportVisible(true)} activeOpacity={0.84}>
        <Text style={styles.exportButtonText}>Export Monthly Sales</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2f6fed" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomer}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No customers yet</Text>
              <Text style={styles.emptyText}>Add your first customer below to start the monthly notebook.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addButtonText}>+ Add Customer</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Customer</Text>
            <TextInput
              style={styles.input}
              placeholder="Customer name"
              placeholderTextColor="#99a7b3"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddCustomer}
            />
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleAddCustomer}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setModalVisible(false); setNewName(''); }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={exportVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExportVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Export Monthly Sales</Text>
            <Text style={styles.modalBodyText}>Choose the month you want to export as a CSV file.</Text>

            <View style={styles.monthPicker}>
              <TouchableOpacity style={styles.monthArrow} onPress={() => moveExportMonth(-1)}>
                <Text style={styles.monthArrowText}>‹</Text>
              </TouchableOpacity>
              <View style={styles.monthValueWrap}>
                <Text style={styles.monthValue}>{formatMonthKey(getMonthKeyFromDate(exportMonth))}</Text>
              </View>
              <TouchableOpacity style={styles.monthArrow} onPress={() => moveExportMonth(1)}>
                <Text style={styles.monthArrowText}>›</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, exporting && { opacity: 0.6 }]}
              onPress={handleExportMonth}
              disabled={exporting}
            >
              <Text style={styles.saveButtonText}>{exporting ? 'Preparing…' : 'Export CSV'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setExportVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
  list: {
    padding: 16,
    paddingBottom: 110,
  },
  headerWrap: {
    marginBottom: 12,
  },
  heroCard: {
    backgroundColor: '#12344d',
    borderRadius: 24,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroLabel: {
    color: '#9fc2de',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtext: {
    color: '#d5e3ee',
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 210,
  },
  countPill: {
    backgroundColor: '#1f4f73',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    minWidth: 92,
  },
  countNumber: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  countLabel: {
    color: '#c8dced',
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#0d2233',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#dce8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2f6fed',
  },
  cardBody: {
    flex: 1,
  },
  cardText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#10212f',
  },
  cardHint: {
    marginTop: 4,
    fontSize: 15,
    color: '#6f8291',
  },
  cardArrowWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#eff5fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrow: {
    fontSize: 28,
    color: '#2f6fed',
  },
  exportButton: {
    backgroundColor: '#dff0e6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#1c7a4a',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 28,
    marginTop: 4,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#12344d',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 17,
    color: '#6f8291',
    lineHeight: 28,
  },
  addButton: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    backgroundColor: '#2f6fed',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#2f6fed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
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
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 16,
  },
  modalBodyText: {
    fontSize: 16,
    color: '#647786',
    lineHeight: 24,
    marginBottom: 18,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#d8e2ea',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 20,
    color: '#1c1c1e',
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  saveButton: {
    backgroundColor: '#2f6fed',
    borderRadius: 12,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: 18,
    color: '#888',
  },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  monthArrow: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrowText: {
    fontSize: 30,
    color: '#12344d',
    marginTop: -2,
  },
  monthValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  monthValue: {
    fontSize: 21,
    fontWeight: '800',
    color: '#12344d',
  },
});
