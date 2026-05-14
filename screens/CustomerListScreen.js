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
} from 'firebase/firestore';
import { db } from '../firebase';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

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

  const filteredCustomers = searchQuery.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : customers;

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
          <Text style={styles.heroSubtext}>Track deliveries, calculate bills easily.</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countNumber}>{customers.length}</Text>
          <Text style={styles.countLabel}>customers</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.billButton} onPress={() => navigation.navigate('BillCalculator')} activeOpacity={0.84}>
        <Text style={styles.billButtonText}>🧾  Bill Calculator</Text>
      </TouchableOpacity>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers…"
          placeholderTextColor="#99a7b3"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.searchClear} onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2f6fed" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomer}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              {searchQuery.trim() ? (
                <>
                  <Text style={styles.emptyTitle}>No results</Text>
                  <Text style={styles.emptyText}>No customers match "{searchQuery.trim()}".</Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>No customers yet</Text>
                  <Text style={styles.emptyText}>Add your first customer below to start the monthly notebook.</Text>
                </>
              )}
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
  billButton: {
    backgroundColor: '#fff4e0',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  billButtonText: {
    color: '#a05c00',
    fontSize: 18,
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#0d2233',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    color: '#12344d',
  },
  searchClear: {
    paddingLeft: 10,
    paddingVertical: 10,
  },
  searchClearText: {
    fontSize: 17,
    color: '#99a7b3',
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

});
