import React, { useEffect, useState, useCallback, useRef } from "react";

// Hook for managing products with persistent storage
const useProductStorage = () => {
  const [products, setProducts] = useState([
    {
      code: "8901262101011",
      name: "Amul Milk",
      calories: 150,
      protein: 8,
      carbs: 12,
      fat: 6,
      image: "🥛"
    },
    {
      code: "8901063101012",
      name: "Parle-G Biscuits",
      calories: 460,
      protein: 6,
      carbs: 76,
      fat: 14,
      image: "🍪"
    }
  ]);
  const [loading, setLoading] = useState(true);

  // Load products from storage on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const stored = await window.storage.get('scanned-products');
        if (stored && stored.value) {
          const parsedProducts = JSON.parse(stored.value);
          setProducts(prev => {
            const existingCodes = new Set(prev.map(p => p.code));
            const newProducts = parsedProducts.filter(p => !existingCodes.has(p.code));
            return [...prev, ...newProducts];
          });
        }
      } catch (error) {
        console.log('No stored products found:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const addProduct = async (newProduct) => {
    try {
      const updatedProducts = [...products, newProduct];
      setProducts(updatedProducts);
      await window.storage.set('scanned-products', JSON.stringify(updatedProducts));
      return true;
    } catch (error) {
      console.error('Error saving product:', error);
      return false;
    }
  };

  return { products, addProduct, loading };
};

// Add Product Modal Component
const AddProductModal = ({ barcode, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    image: '📦'
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = ['🥛', '🍪', '🍞', '🥤', '🍕', '🍔', '🍗', '🥗', '🍎', '🍌', '🥚', '🧀', '🥜', '🍫', '☕', '🧃', '🍵', '🥫', '🍚', '🌮', '📦'];

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }
    
    if (!formData.calories || isNaN(formData.calories) || Number(formData.calories) < 0) {
      newErrors.calories = 'Valid calories required';
    }
    
    if (!formData.protein || isNaN(formData.protein) || Number(formData.protein) < 0) {
      newErrors.protein = 'Valid protein amount required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    const newProduct = {
      code: barcode,
      name: formData.name.trim(),
      calories: Number(formData.calories),
      protein: Number(formData.protein),
      carbs: formData.carbs ? Number(formData.carbs) : 0,
      fat: formData.fat ? Number(formData.fat) : 0,
      image: formData.image,
      dateAdded: new Date().toISOString()
    };

    const success = await onAdd(newProduct);
    
    if (success) {
      alert('✅ Product added successfully!');
      onClose(true);
    } else {
      alert('❌ Failed to save product. Please try again.');
    }
    
    setIsSubmitting(false);
  };

  return (
    <div style={modalStyles.overlay} onClick={() => onClose(false)}>
      <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div style={modalStyles.headerLeft}>
            <div style={modalStyles.iconCircle}>📝</div>
            <h2 style={modalStyles.title}>Add New Product</h2>
          </div>
          <button onClick={() => onClose(false)} style={modalStyles.closeButton}>
            ✕
          </button>
        </div>

        <div style={modalStyles.barcodeInfo}>
          <span style={modalStyles.barcodeIcon}>📊</span>
          <div>
            <span style={modalStyles.barcodeLabel}>Barcode</span>
            <span style={modalStyles.barcodeValue}>{barcode}</span>
          </div>
        </div>

        <div style={modalStyles.form}>
          <div style={modalStyles.formGroup}>
            <label style={modalStyles.label}>
              Product Icon
              <span style={modalStyles.optional}> (optional)</span>
            </label>
            <div style={modalStyles.emojiContainer}>
              <button 
                type="button"
                style={modalStyles.emojiButton}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <span style={modalStyles.selectedEmoji}>{formData.image}</span>
                <span style={modalStyles.emojiArrow}>▼</span>
              </button>
              {showEmojiPicker && (
                <div style={modalStyles.emojiPicker}>
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      style={modalStyles.emojiOption}
                      onClick={() => {
                        setFormData({...formData, image: emoji});
                        setShowEmojiPicker(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={modalStyles.formGroup}>
            <label style={modalStyles.label}>
              Product Name <span style={modalStyles.required}>*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              style={{...modalStyles.input, ...(errors.name ? modalStyles.inputError : {})}}
              placeholder="e.g., Coca Cola 500ml"
            />
            {errors.name && <span style={modalStyles.error}>{errors.name}</span>}
          </div>

          <div style={modalStyles.formRow}>
            <div style={modalStyles.formGroup}>
              <label style={modalStyles.label}>
                Calories <span style={modalStyles.required}>*</span>
              </label>
              <div style={modalStyles.inputWithUnit}>
                <input
                  type="number"
                  value={formData.calories}
                  onChange={(e) => setFormData({...formData, calories: e.target.value})}
                  style={{...modalStyles.input, ...(errors.calories ? modalStyles.inputError : {})}}
                  placeholder="150"
                />
                <span style={modalStyles.unit}>kcal</span>
              </div>
              {errors.calories && <span style={modalStyles.error}>{errors.calories}</span>}
            </div>

            <div style={modalStyles.formGroup}>
              <label style={modalStyles.label}>
                Protein <span style={modalStyles.required}>*</span>
              </label>
              <div style={modalStyles.inputWithUnit}>
                <input
                  type="number"
                  value={formData.protein}
                  onChange={(e) => setFormData({...formData, protein: e.target.value})}
                  style={{...modalStyles.input, ...(errors.protein ? modalStyles.inputError : {})}}
                  placeholder="8"
                />
                <span style={modalStyles.unit}>g</span>
              </div>
              {errors.protein && <span style={modalStyles.error}>{errors.protein}</span>}
            </div>
          </div>

          <div style={modalStyles.formRow}>
            <div style={modalStyles.formGroup}>
              <label style={modalStyles.label}>
                Carbs <span style={modalStyles.optional}>(optional)</span>
              </label>
              <div style={modalStyles.inputWithUnit}>
                <input
                  type="number"
                  value={formData.carbs}
                  onChange={(e) => setFormData({...formData, carbs: e.target.value})}
                  style={modalStyles.input}
                  placeholder="0"
                />
                <span style={modalStyles.unit}>g</span>
              </div>
            </div>

            <div style={modalStyles.formGroup}>
              <label style={modalStyles.label}>
                Fat <span style={modalStyles.optional}>(optional)</span>
              </label>
              <div style={modalStyles.inputWithUnit}>
                <input
                  type="number"
                  value={formData.fat}
                  onChange={(e) => setFormData({...formData, fat: e.target.value})}
                  style={modalStyles.input}
                  placeholder="0"
                />
                <span style={modalStyles.unit}>g</span>
              </div>
            </div>
          </div>
        </div>

        <div style={modalStyles.footer}>
          <button 
            onClick={() => onClose(false)} 
            style={modalStyles.cancelButton}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            style={{
              ...modalStyles.submitButton,
              ...(isSubmitting ? modalStyles.submitButtonDisabled : {})
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? '⏳ Adding...' : '✅ Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Barcode Scanner Component
export default function BarcodeScannerScreen() {
  const { products, addProduct, loading } = useProductStorage();
  const [isScanning, setIsScanning] = useState(true);
  const [scannedCode, setScannedCode] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [scanning, setScanning] = useState(false);

  const simulateScan = (code) => {
    setScanning(true);
    setScannedCode(code);
    
    setTimeout(() => {
      const product = products.find(p => p.code === code);
      
      if (product) {
        setFoundProduct(product);
        setIsScanning(false);
      } else {
        setPendingBarcode(code);
        setShowAddModal(true);
        setIsScanning(true);
      }
      setScanning(false);
    }, 1000);
  };

  const handleAddProduct = async (newProduct) => {
    const success = await addProduct(newProduct);
    return success;
  };

  const handleModalClose = (productAdded) => {
    setShowAddModal(false);
    if (productAdded) {
      setTimeout(() => {
        const product = products.find(p => p.code === pendingBarcode);
        if (product) {
          setFoundProduct(product);
          setIsScanning(false);
        }
      }, 100);
    }
    setPendingBarcode('');
  };

  const handleReset = () => {
    setIsScanning(true);
    setScannedCode('');
    setFoundProduct(null);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading scanner...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerIcon}>📱</div>
          <div>
            <h1 style={styles.headerTitle}>Barcode Scanner</h1>
            <p style={styles.headerSubtitle}>Scan products to view nutritional information</p>
          </div>
        </div>
      </div>

      {isScanning ? (
        <div style={styles.scannerSection}>
          <div style={styles.scannerCard}>
            <div style={styles.scannerFrame}>
              <div style={{...styles.corner, ...styles.topLeft}} />
              <div style={{...styles.corner, ...styles.topRight}} />
              <div style={{...styles.corner, ...styles.bottomLeft}} />
              <div style={{...styles.corner, ...styles.bottomRight}} />
              <div style={styles.scanLine} />
              {scanning && (
                <div style={styles.scanningOverlay}>
                  <div style={styles.scanningPulse}></div>
                </div>
              )}
            </div>
            
            <div style={styles.instructionBox}>
              <span style={styles.instructionIcon}>🎯</span>
              <p style={styles.instructionText}>Position barcode within the frame</p>
            </div>
          </div>
          
          <div style={styles.demoSection}>
            <p style={styles.demoLabel}>
              <span style={styles.demoIcon}>⚡</span>
              Quick Demo Scans
            </p>
            <div style={styles.demoButtons}>
              <button 
                onClick={() => simulateScan('8901262101011')} 
                style={styles.demoButton}
                disabled={scanning}
              >
                <span style={styles.demoButtonIcon}>🥛</span>
                <span>Amul Milk</span>
              </button>
              <button 
                onClick={() => simulateScan('8901063101012')} 
                style={styles.demoButton}
                disabled={scanning}
              >
                <span style={styles.demoButtonIcon}>🍪</span>
                <span>Parle-G</span>
              </button>
              <button 
                onClick={() => simulateScan('1234567890123')} 
                style={{...styles.demoButton, ...styles.demoButtonUnknown}}
                disabled={scanning}
              >
                <span style={styles.demoButtonIcon}>❓</span>
                <span>Unknown Product</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.productSection}>
          <div style={styles.productCard}>
            <div style={styles.productHeader}>
              <span style={styles.productEmoji}>{foundProduct.image}</span>
              <div style={styles.successBadge}>
                <span style={styles.successIcon}>✓</span>
                <span>Found</span>
              </div>
            </div>
            
            <h2 style={styles.productName}>{foundProduct.name}</h2>
            <div style={styles.barcodeChip}>
              <span style={styles.barcodeIcon}>📊</span>
              <span style={styles.barcodeText}>{foundProduct.code}</span>
            </div>
            
            <div style={styles.nutritionGrid}>
              <div style={{...styles.nutritionItem, ...styles.caloriesItem}}>
                <span style={styles.nutritionIcon}>🔥</span>
                <span style={styles.nutritionValue}>{foundProduct.calories}</span>
                <span style={styles.nutritionLabel}>Calories</span>
              </div>
              <div style={{...styles.nutritionItem, ...styles.proteinItem}}>
                <span style={styles.nutritionIcon}>💪</span>
                <span style={styles.nutritionValue}>{foundProduct.protein}g</span>
                <span style={styles.nutritionLabel}>Protein</span>
              </div>
              <div style={{...styles.nutritionItem, ...styles.carbsItem}}>
                <span style={styles.nutritionIcon}>🌾</span>
                <span style={styles.nutritionValue}>{foundProduct.carbs}g</span>
                <span style={styles.nutritionLabel}>Carbs</span>
              </div>
              <div style={{...styles.nutritionItem, ...styles.fatItem}}>
                <span style={styles.nutritionIcon}>🥑</span>
                <span style={styles.nutritionValue}>{foundProduct.fat}g</span>
                <span style={styles.nutritionLabel}>Fat</span>
              </div>
            </div>

            <button onClick={handleReset} style={styles.scanAgainButton}>
              <span style={styles.scanAgainIcon}>🔄</span>
              <span>Scan Another Product</span>
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddProductModal
          barcode={pendingBarcode}
          onClose={handleModalClose}
          onAdd={handleAddProduct}
        />
      )}

      <div style={styles.savedProducts}>
        <div style={styles.savedHeader}>
          <div style={styles.savedHeaderLeft}>
            <span style={styles.savedIcon}>💾</span>
            <h3 style={styles.savedTitle}>Saved Products</h3>
          </div>
          <div style={styles.savedBadge}>{products.length}</div>
        </div>
        
        <div style={styles.productsList}>
          {products.map((product, index) => (
            <div key={index} style={styles.savedProductItem}>
              <span style={styles.savedProductEmoji}>{product.image}</span>
              <div style={styles.savedProductInfo}>
                <span style={styles.savedProductName}>{product.name}</span>
                <span style={styles.savedProductCode}>{product.code}</span>
              </div>
              <div style={styles.savedProductStats}>
                <span style={styles.savedProductStat}>
                  🔥 {product.calories}
                </span>
                <span style={styles.savedProductStat}>
                  💪 {product.protein}g
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 10px; }
          50% { top: calc(100% - 12px); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '20px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600'
  },
  header: {
    marginBottom: '30px'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  headerIcon: {
    fontSize: '48px',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
  },
  headerTitle: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#fff',
    margin: '0 0 4px 0',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
  },
  headerSubtitle: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.9)',
    margin: 0
  },
  scannerSection: {
    marginBottom: '30px'
  },
  scannerCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    marginBottom: '20px'
  },
  scannerFrame: {
    width: '320px',
    height: '320px',
    margin: '0 auto 30px',
    position: 'relative',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)'
  },
  corner: {
    position: 'absolute',
    width: '50px',
    height: '50px',
    borderColor: '#00FF88',
    borderWidth: '4px',
    borderStyle: 'solid',
    borderRadius: '4px'
  },
  topLeft: {
    top: '15px',
    left: '15px',
    borderBottom: 'none',
    borderRight: 'none'
  },
  topRight: {
    top: '15px',
    right: '15px',
    borderBottom: 'none',
    borderLeft: 'none'
  },
  bottomLeft: {
    bottom: '15px',
    left: '15px',
    borderTop: 'none',
    borderRight: 'none'
  },
  bottomRight: {
    bottom: '15px',
    right: '15px',
    borderTop: 'none',
    borderLeft: 'none'
  },
  scanLine: {
    position: 'absolute',
    left: '15px',
    right: '15px',
    height: '3px',
    backgroundColor: '#00FF88',
    boxShadow: '0 0 20px #00FF88',
    animation: 'scan 2s ease-in-out infinite',
    borderRadius: '2px'
  },
  scanningOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)'
  },
  scanningPulse: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 255, 136, 0.3)',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  instructionBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '16px',
    border: '2px dashed #667eea'
  },
  instructionIcon: {
    fontSize: '28px'
  },
  instructionText: {
    fontSize: '18px',
    color: '#667eea',
    margin: 0,
    fontWeight: '600'
  },
  demoSection: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '30px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  demoLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '18px',
    color: '#1a1a1a',
    marginBottom: '20px',
    fontWeight: '700'
  },
  demoIcon: {
    fontSize: '24px'
  },
  demoButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px'
  },
  demoButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '18px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
  },
  demoButtonUnknown: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    boxShadow: '0 4px 12px rgba(245, 87, 108, 0.4)'
  },
  demoButtonIcon: {
    fontSize: '24px'
  },
  productSection: {
    marginBottom: '30px'
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center'
  },
  productHeader: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px'
  },
  productEmoji: {
    fontSize: '80px',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
  },
  successBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    color: '#fff',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '700',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  },
  successIcon: {
    fontSize: '16px'
  },
  productName: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: '16px',
    lineHeight: '1.2'
  },
  barcodeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    marginBottom: '32px'
  },
  barcodeIcon: {
    fontSize: '18px'
  },
  barcodeText: {
    fontSize: '15px',
    color: '#666',
    fontFamily: 'monospace',
    fontWeight: '600'
  },
  nutritionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  nutritionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px',
    borderRadius: '16px',
    transition: 'transform 0.3s ease'
  },
  caloriesItem: {
    background: 'linear-gradient(135deg, #FF6B6B20 0%, #FF6B6B10 100%)',
    border: '2px solid #FF6B6B40'
  },
  proteinItem: {
    background: 'linear-gradient(135deg, #4D96FF20 0%, #4D96FF10 100%)',
    border: '2px solid #4D96FF40'
  },
  carbsItem: {
    background: 'linear-gradient(135deg, #FFB84D20 0%, #FFB84D10 100%)',
    border: '2px solid #FFB84D40'
  },
  fatItem: {
    background: 'linear-gradient(135deg, #A78BFA20 0%, #A78BFA10 100%)',
    border: '2px solid #A78BFA40'
  },
  nutritionIcon: {
    fontSize: '32px',
    marginBottom: '12px'
  },
  nutritionValue: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: '6px'
  },
  nutritionLabel: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  scanAgainButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '18px 36px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)'
  },
  scanAgainIcon: {
    fontSize: '20px'
  },
  savedProducts: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '30px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  savedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  savedHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  savedIcon: {
    fontSize: '28px'
  },
  savedTitle: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#1a1a1a',
    margin: 0
  },
  savedBadge: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '700',
    minWidth: '40px',
    textAlign: 'center'
  },
  productsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  savedProductItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
    borderRadius: '16px',
    border: '2px solid #f0f0f0',
    transition: 'all 0.3s ease'
  },
  savedProductEmoji: {
    fontSize: '40px'
  },
  savedProductInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  savedProductName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a1a'
  },
  savedProductCode: {
    fontSize: '13px',
    color: '#999',
    fontFamily: 'monospace',
    fontWeight: '500'
  },
  savedProductStats: {
    display: 'flex',
    gap: '12px'
  },
  savedProductStat: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
    padding: '6px 12px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  }
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    width: '90%',
    maxWidth: '550px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '28px 28px 20px',
    borderBottom: '2px solid #f0f0f0'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  iconCircle: {
    fontSize: '32px',
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
    borderRadius: '16px'
  },
  title: {
    fontSize: '26px',
    fontWeight: '800',
    color: '#1a1a1a',
    margin: 0
  },
  closeButton: {
    fontSize: '28px',
    color: '#999',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    transition: 'all 0.3s ease'
  },
  barcodeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '20px 28px',
    background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
    borderBottom: '2px solid #f0f0f0'
  },
  barcodeIcon: {
    fontSize: '28px'
  },
  barcodeLabel: {
    display: 'block',
    fontSize: '13px',
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px'
  },
  barcodeValue: {
    display: 'block',
    fontSize: '18px',
    color: '#1a1a1a',
    fontFamily: 'monospace',
    fontWeight: '700'
  },
  form: {
    padding: '28px'
  },
  formGroup: {
    marginBottom: '24px',
    flex: 1
  },
  formRow: {
    display: 'flex',
    gap: '16px'
  },
  label: {
    display: 'block',
    fontSize: '15px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '10px'
  },
  required: {
    color: '#FF3B30',
    fontSize: '16px'
  },
  optional: {
    color: '#999',
    fontWeight: '500',
    fontSize: '13px'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    fontWeight: '500'
  },
  inputWithUnit: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  unit: {
    position: 'absolute',
    right: '16px',
    fontSize: '14px',
    color: '#999',
    fontWeight: '600',
    pointerEvents: 'none'
  },
  inputError: {
    borderColor: '#FF3B30'
  },
  error: {
    display: 'block',
    fontSize: '13px',
    color: '#FF3B30',
    marginTop: '6px',
    fontWeight: '500'
  },
  emojiContainer: {
    position: 'relative'
  },
  emojiButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },
  selectedEmoji: {
    fontSize: '28px'
  },
  emojiArrow: {
    fontSize: '12px',
    color: '#999'
  },
  emojiPicker: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#fff',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px',
    zIndex: 10
  },
  emojiOption: {
    fontSize: '28px',
    padding: '8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.2s ease'
  },
  footer: {
    display: 'flex',
    gap: '14px',
    padding: '20px 28px 28px',
    borderTop: '2px solid #f0f0f0'
  },
  cancelButton: {
    flex: 1,
    padding: '16px',
    fontSize: '17px',
    fontWeight: '700',
    color: '#666',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },
  submitButton: {
    flex: 1,
    padding: '16px',
    fontSize: '17px',
    fontWeight: '700',
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
  },
  submitButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  }
};