import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// IndexedDB helper functions
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EstoqueDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Items store
      if (!db.objectStoreNames.contains('items')) {
        const itemsStore = db.createObjectStore('items', { keyPath: 'id' });
        itemsStore.createIndex('name', 'name', { unique: false });
        itemsStore.createIndex('code', 'code', { unique: true });
      }
      
      // Movements store
      if (!db.objectStoreNames.contains('movements')) {
        const movementsStore = db.createObjectStore('movements', { keyPath: 'id' });
        movementsStore.createIndex('timestamp', 'timestamp', { unique: false });
        movementsStore.createIndex('item_id', 'item_id', { unique: false });
      }
      
      // Users store
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        usersStore.createIndex('username', 'username', { unique: true });
      }
      
      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
};

const dbOperation = async (storeName, operation, data = null) => {
  const db = await initDB();
  const transaction = db.transaction([storeName], operation === 'get' || operation === 'getAll' ? 'readonly' : 'readwrite');
  const store = transaction.objectStore(storeName);
  
  switch (operation) {
    case 'add':
      return store.add(data);
    case 'put':
      return store.put(data);
    case 'get':
      return store.get(data);
    case 'getAll':
      return store.getAll();
    case 'delete':
      return store.delete(data);
    default:
      throw new Error('Invalid operation');
  }
};

// Utility functions
const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Components
const LoginForm = ({ onLogin, onToggleRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const db = await initDB();
      const transaction = db.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const users = await store.getAll();
      
      const user = users.find(u => u.username === username && u.password === password);
      
      if (user) {
        onLogin(user);
      } else {
        setError('Usuário ou senha inválidos');
      }
    } catch (error) {
      setError('Erro ao fazer login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Controle de Estoque
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Faça login para acessar o sistema
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="text"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Entrar
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onToggleRegister}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              Não tem conta? Cadastre-se
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RegisterForm = ({ onRegister, onToggleLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Senhas não coincidem');
      return;
    }
    
    try {
      const user = {
        id: generateId(),
        username,
        email,
        password,
        created_at: new Date().toISOString()
      };
      
      await dbOperation('users', 'add', user);
      onRegister(user);
    } catch (error) {
      if (error.name === 'ConstraintError') {
        setError('Usuário já existe');
      } else {
        setError('Erro ao criar conta');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Criar Conta
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input
              type="text"
              required
              className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="email"
              required
              className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              required
              className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              required
              className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Confirmar Senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Criar Conta
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onToggleLogin}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              Já tem conta? Faça login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Dashboard = ({ darkMode, toggleDarkMode, user, onLogout, items, movements, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showModal, setShowModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Calculate stats
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const lowStockItems = items.filter(item => item.quantity <= (item.min_stock || 10)).length;
  const categories = [...new Set(items.map(item => item.category || 'Geral'))].length;

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const allCategories = [...new Set(items.map(item => item.category || 'Geral'))];

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'} transition-colors`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                📦 Controle de Estoque
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Olá, {user.username}
              </div>
              <button
                onClick={onLogout}
                className="text-sm text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'items', label: 'Itens', icon: '📦' },
              { id: 'movements', label: 'Movimentações', icon: '📋' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <DashboardTab
            totalItems={totalItems}
            totalQuantity={totalQuantity}
            totalValue={totalValue}
            lowStockItems={lowStockItems}
            categories={categories}
            items={items}
            movements={movements}
            darkMode={darkMode}
          />
        )}
        
        {activeTab === 'items' && (
          <ItemsTab
            items={filteredItems}
            allCategories={allCategories}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            onAddItem={() => setShowModal('add')}
            onEditItem={(item) => {
              setEditingItem(item);
              setShowModal('edit');
            }}
            onDeleteItem={(item) => {
              setEditingItem(item);
              setShowModal('delete');
            }}
            onMoveStock={(item) => {
              setEditingItem(item);
              setShowModal('movement');
            }}
            onRefresh={onRefresh}
            darkMode={darkMode}
          />
        )}
        
        {activeTab === 'movements' && (
          <MovementsTab
            movements={movements}
            darkMode={darkMode}
          />
        )}
      </main>

      {/* Modals */}
      {showModal === 'add' && (
        <ItemModal
          onClose={() => setShowModal(null)}
          onSave={onRefresh}
          darkMode={darkMode}
        />
      )}
      
      {showModal === 'edit' && editingItem && (
        <ItemModal
          item={editingItem}
          onClose={() => {
            setShowModal(null);
            setEditingItem(null);
          }}
          onSave={onRefresh}
          darkMode={darkMode}
        />
      )}
      
      {showModal === 'delete' && editingItem && (
        <DeleteModal
          item={editingItem}
          onClose={() => {
            setShowModal(null);
            setEditingItem(null);
          }}
          onConfirm={onRefresh}
          darkMode={darkMode}
        />
      )}
      
      {showModal === 'movement' && editingItem && (
        <MovementModal
          item={editingItem}
          onClose={() => {
            setShowModal(null);
            setEditingItem(null);
          }}
          onSave={onRefresh}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};

const DashboardTab = ({ totalItems, totalQuantity, totalValue, lowStockItems, categories, items, movements, darkMode }) => {
  const recentMovements = movements.slice(0, 5);
  const lowStockItemsList = items.filter(item => item.quantity <= (item.min_stock || 10)).slice(0, 5);

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all hover:shadow-md">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">📦</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total de Itens
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {totalItems}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all hover:shadow-md">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">📊</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Quantidade Total
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {totalQuantity.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all hover:shadow-md">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">💰</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Valor Total
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatCurrency(totalValue)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all hover:shadow-md">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">⚠️</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Estoque Baixo
                  </dt>
                  <dd className="text-lg font-medium text-red-600 dark:text-red-400">
                    {lowStockItems}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all hover:shadow-md">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">🏷️</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Categorias
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {categories}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Movements */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Movimentações Recentes
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {recentMovements.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nenhuma movimentação registrada
              </p>
            ) : (
              <div className="space-y-3">
                {recentMovements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        movement.type === 'entrada' ? 'bg-green-400' :
                        movement.type === 'saida' ? 'bg-red-400' : 'bg-yellow-400'
                      }`}></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {movement.item_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {movement.type === 'entrada' ? '+' : movement.type === 'saida' ? '-' : '='}{movement.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(movement.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Itens com Estoque Baixo
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {lowStockItemsList.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Todos os itens estão com estoque adequado
              </p>
            ) : (
              <div className="space-y-3">
                {lowStockItemsList.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Código: {item.code}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        {item.quantity} restantes
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ItemsTab = ({ 
  items, 
  allCategories, 
  searchTerm, 
  setSearchTerm, 
  filterCategory, 
  setFilterCategory,
  onAddItem, 
  onEditItem, 
  onDeleteItem, 
  onMoveStock,
  onRefresh,
  darkMode 
}) => {
  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 gap-4 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none sm:w-64">
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <select
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {allCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
          >
            🔄 Atualizar
          </button>
          <button
            onClick={onAddItem}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            ➕ Adicionar Item
          </button>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Preço
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Localização
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhum item encontrado
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.quantity <= (item.min_stock || 10)
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : item.quantity <= (item.min_stock || 10) * 2
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {item.category || 'Geral'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => onMoveStock(item)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        title="Movimentar"
                      >
                        📊
                      </button>
                      <button
                        onClick={() => onEditItem(item)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDeleteItem(item)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MovementsTab = ({ movements, darkMode }) => {
  const [filteredMovements, setFilteredMovements] = useState(movements);
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    let filtered = movements;
    
    if (typeFilter) {
      filtered = filtered.filter(m => m.type === typeFilter);
    }
    
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(m => {
        const movementDate = new Date(m.timestamp);
        return movementDate.toDateString() === filterDate.toDateString();
      });
    }
    
    setFilteredMovements(filtered);
  }, [movements, typeFilter, dateFilter]);

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
        <div>
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
        {(typeFilter || dateFilter) && (
          <button
            onClick={() => {
              setTypeFilter('');
              setDateFilter('');
            }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Movements Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Usuário
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma movimentação encontrada
                  </td>
                </tr>
              ) : (
                filteredMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(movement.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {movement.item_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        movement.type === 'entrada'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : movement.type === 'saida'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {movement.type === 'entrada' ? '📈 Entrada' :
                         movement.type === 'saida' ? '📉 Saída' : '⚖️ Ajuste'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {movement.type === 'entrada' ? '+' : movement.type === 'saida' ? '-' : '='}{movement.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                      {movement.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {movement.user}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Modal Components
const ItemModal = ({ item, onClose, onSave, darkMode }) => {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    code: item?.code || '',
    quantity: item?.quantity || 0,
    price: item?.price || 0,
    location: item?.location || '',
    category: item?.category || 'Geral',
    min_stock: item?.min_stock || 10
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (item) {
        // Update existing item
        await dbOperation('items', 'put', { ...item, ...formData, updated_at: new Date().toISOString() });
      } else {
        // Create new item
        const newItem = {
          id: generateId(),
          ...formData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await dbOperation('items', 'add', newItem);
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Erro ao salvar item');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div
="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {item ? 'Editar Item' : 'Adicionar Item'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nome
              </label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Código
              </label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Preço (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Localização
              </label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoria
                </label>
                <select
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Geral">Geral</option>
                  <option value="EPI">EPI</option>
                  <option value="Peças">Peças</option>
                  <option value="Fardamento">Fardamento</option>
                  <option value="Ferramentas">Ferramentas</option>
                  <option value="Material de Escritório">Material de Escritório</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Estoque Mínimo
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              {item ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteModal = ({ item, onClose, onConfirm, darkMode }) => {
  const handleDelete = async () => {
    try {
      await dbOperation('items', 'delete', item.id);
      onConfirm();
      onClose();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Erro ao excluir item');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="text-4xl">⚠️</div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Confirmar Exclusão
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Tem certeza de que deseja excluir o item <strong>{item.name}</strong>? 
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-600 dark:text-white dark:border-gray-500 dark:hover:bg-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

const MovementModal = ({ item, onClose, onSave, darkMode }) => {
  const [formData, setFormData] = useState({
    type: 'entrada',
    quantity: 1,
    reason: '',
    user: 'Usuário'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Create movement record
      const movement = {
        id: generateId(),
        item_id: item.id,
        item_name: item.name,
        type: formData.type,
        quantity: formData.quantity,
        reason: formData.reason,
        user: formData.user,
        timestamp: new Date().toISOString()
      };
      
      await dbOperation('movements', 'add', movement);
      
      // Update item quantity
      let newQuantity = item.quantity;
      if (formData.type === 'entrada') {
        newQuantity += formData.quantity;
      } else if (formData.type === 'saida') {
        newQuantity = Math.max(0, newQuantity - formData.quantity);
      } else { // ajuste
        newQuantity = formData.quantity;
      }
      
      const updatedItem = {
        ...item,
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      };
      
      await dbOperation('items', 'put', updatedItem);
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error creating movement:', error);
      alert('Erro ao registrar movimentação');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Movimentar Estoque - {item.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Estoque atual: {item.quantity}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo de Movimentação
              </label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="entrada">📈 Entrada (Adicionar)</option>
                <option value="saida">📉 Saída (Remover)</option>
                <option value="ajuste">⚖️ Ajuste (Definir quantidade)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Motivo/Observação
              </label>
              <textarea
                required
                rows="3"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Descreva o motivo da movimentação..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Usuário Responsável
              </label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={formData.user}
                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              />
            </div>
            
            {/* Preview */}
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Preview:</strong>
                {formData.type === 'entrada' && ` ${item.quantity} + ${formData.quantity} = ${item.quantity + formData.quantity}`}
                {formData.type === 'saida' && ` ${item.quantity} - ${formData.quantity} = ${Math.max(0, item.quantity - formData.quantity)}`}
                {formData.type === 'ajuste' && ` ${item.quantity} → ${formData.quantity}`}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Confirmar Movimentação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        await initDB();
        
        // Load settings
        const db = await initDB();
        const settingsStore = db.transaction(['settings'], 'readonly').objectStore('settings');
        const darkModeSetting = await settingsStore.get('darkMode');
        
        if (darkModeSetting) {
          setDarkMode(darkModeSetting.value);
        }
        
        // Auto-login if user exists (for demo purposes)
        const usersStore = db.transaction(['users'], 'readonly').objectStore('users');
        const users = await usersStore.getAll();
        
        if (users.length > 0) {
          setUser(users[0]);
          loadData();
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initApp();
  }, []);

  // Load data
  const loadData = async () => {
    try {
      const [itemsData, movementsData] = await Promise.all([
        dbOperation('items', 'getAll'),
        dbOperation('movements', 'getAll')
      ]);
      
      setItems(itemsData || []);
      setMovements((movementsData || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Save dark mode preference
  const toggleDarkMode = async () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    try {
      await dbOperation('settings', 'put', { key: 'darkMode', value: newDarkMode });
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    loadData();
  };

  const handleRegister = (userData) => {
    setUser(userData);
    setIsRegister(false);
    loadData();
  };

  const handleLogout = () => {
    setUser(null);
    setItems([]);
    setMovements([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">📦</div>
          <div className="text-lg text-gray-600 dark:text-gray-300">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return isRegister ? (
      <RegisterForm
        onRegister={handleRegister}
        onToggleLogin={() => setIsRegister(false)}
      />
    ) : (
      <LoginForm
        onLogin={handleLogin}
        onToggleRegister={() => setIsRegister(true)}
      />
    );
  }

  return (
    <Dashboard
      darkMode={darkMode}
      toggleDarkMode={toggleDarkMode}
      user={user}
      onLogout={handleLogout}
      items={items}
      movements={movements}
      onRefresh={loadData}
    />
  );
}

export default App;