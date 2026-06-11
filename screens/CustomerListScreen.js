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
        <Text style={styles.cardText}>{item.name}</Text>
      </View>
      <Text style={styles.cardArrow}>›</Text>
    </TouchableOpacity>
  );

  const listHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.statsRow}>
        <Text style={styles.pageTitle}>All Customers</Text>
        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{customers.length}</Text>
        </View>
      </View>

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
    backgroundColor: '#f2f6fa',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  headerWrap: {
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#12344d',
  },
  countChip: {
    backgroundColor: '#dce8ff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countChipText: {
    color: '#2f6fed',
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#0d2233',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#dce8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2f6fed',
  },
  cardText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10212f',
  },
  cardArrow: {
    fontSize: 22,
    color: '#b0bec9',
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
