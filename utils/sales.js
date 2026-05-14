import { addDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';

export function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDate(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function parseDateString(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return normalizeDate(nextDate);
}

export function getLastNDates(count, fromDate = new Date()) {
  const startDate = normalizeDate(fromDate);
  return Array.from({ length: count }, (_, index) => addDays(startDate, -index));
}

export function getMonthKeyFromDate(date) {
  const normalizedDate = normalizeDate(date);
  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getMonthKeyFromDateString(dateString) {
  return dateString.slice(0, 7);
}

export function getCurrentMonthKey() {
  return getMonthKeyFromDate(new Date());
}

export function getNextMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return getMonthKeyFromDate(new Date(year, month, 1));
}

export function formatMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatEntryDate(dateString) {
  return parseDateString(dateString).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLongDate(date) {
  return normalizeDate(date).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export async function saveOrMergeEntry(db, customerId, dateString, quantityValue) {
  const entriesRef = collection(db, 'customers', customerId, 'entries');
  const existingEntries = await getDocs(query(entriesRef, where('date', '==', dateString)));

  if (!existingEntries.size) {
    await addDoc(entriesRef, {
      date: dateString,
      quantity: quantityValue,
    });
    return;
  }

  const [firstEntry, ...restEntries] = existingEntries.docs;
  const currentTotal = existingEntries.docs.reduce((sum, entryDoc) => {
    return sum + (Number(entryDoc.data().quantity) || 0);
  }, 0);
  const batch = writeBatch(db);
  batch.update(firstEntry.ref, {
    date: dateString,
    quantity: currentTotal + quantityValue,
  });
  restEntries.forEach((entryDoc) => batch.delete(entryDoc.ref));
  await batch.commit();
}