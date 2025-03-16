class SquareItemExtractor {
  constructor() {
    this.headers = [
      'Item Name',
      'Category',
      'SKU',
      'Price',
      'Price Unit',
      'Track Stock',
      'Stock Alert Enabled',
      'Stock Alert Count',
      'Quantity',
      'Stock',
      'Tax',
      'Image URL',
      'Variations',
      'Show Online',
      'Item Visibility'
    ];
  }

  async extractPageData(tab, settings) {
    const extractData = () => {
      const rawTitle = document.querySelector('h1')?.textContent || 'Untitled';
      const imageUrl = document.querySelector('img')?.src || '';
      return { rawTitle, imageUrl };
    };

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractData
    });

    const data = result.result || {};
    const itemName = `${data.rawTitle.trim()} (${settings.category})`;

    return {
      'Item Name': itemName,
      'Category': settings.category || 'Uncategorized',
      'SKU': itemName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      'Price': (settings.price || 0).toFixed(2),
      'Price Unit': 'Per Item',
      'Track Stock': 'Y',
      'Stock Alert Enabled': 'N',
      'Stock Alert Count': '',
      'Stock': settings.stock || 0,
      'Tax': 'Y',
      'Image URL': data.imageUrl,
      'Variations': 'Standard',
      'Show Online': 'Y',
      'Item Visibility': 'PUBLIC'
    };
  }

  copyDataForGoogleSheets(data) {
    const values = this.headers.map(header => data[header] || '');
    const formattedData = values.join(','); // Comma-separated for horizontal format in Google Sheets
    navigator.clipboard.writeText(formattedData).then(() => {
      const statusDiv = document.getElementById('status');
      statusDiv.textContent = 'Data copied to clipboard as CSV for Google Sheets! Paste in cell > Click Data on the top bar > Select Split text to columns';
    }).catch(err => {
      const statusDiv = document.getElementById('status');
      statusDiv.textContent = `Error copying data: ${err.message}`;
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const extractor = new SquareItemExtractor();
  const resultDiv = document.getElementById('result');
  const statusDiv = document.getElementById('status');
  const progressDiv = document.getElementById('progress');
  let extractedData = null;

  const showProgress = (message) => {
    progressDiv.textContent = message;
    progressDiv.style.display = 'block';
  };

  const hideProgress = () => {
    progressDiv.style.display = 'none';
  };

  // Add functionality to auto-select text in the "Add Stock" input
  const stockInput = document.getElementById('stock');
  stockInput.addEventListener('focus', () => {
    stockInput.select();
  });

  // Add functionality to auto-select text in the "Set Price" input
  const priceInput = document.getElementById('price');
  priceInput.addEventListener('focus', () => {
    priceInput.select();
  });

  // Add functionality to append '.99' to the price when losing focus
  priceInput.addEventListener('blur', () => {
    let value = parseFloat(priceInput.value);
    if (!isNaN(value)) {
      if (Number.isInteger(value)) {
        value = value + 0.99;
      }
      priceInput.value = value.toFixed(2);
    }
  });

  document.getElementById('extract').addEventListener('click', async function() {
    const settings = {
      category: document.getElementById('category').value,
      price: parseFloat(priceInput.value) || 0,
      stock: parseInt(stockInput.value) || 0
    };

    try {
      showProgress('Extracting data...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      extractedData = await extractor.extractPageData(tabs[0], settings);

      resultDiv.textContent = 'Data extracted successfully!';
      statusDiv.textContent = 'Ready to copy or download';
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
      statusDiv.textContent = 'Extraction failed';
    } finally {
      hideProgress();
    }
  });

  document.getElementById('copy-extract').addEventListener('click', function() {
    if (!extractedData) {
      statusDiv.textContent = 'Please extract data first';
      return;
    }

    extractor.copyDataForGoogleSheets(extractedData);
  });

  document.getElementById('download').addEventListener('click', function() {
    if (!extractedData) {
      statusDiv.textContent = 'Please extract data first';
      return;
    }

    const filenameInput = document.getElementById('filename');
    const filename = filenameInput.value.trim() || 'items.csv';

    const csvContent = extractor.headers.join(',') + '\n' +
      extractor.headers.map(header => extractedData[header] || '').join(',');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    statusDiv.textContent = 'CSV file downloaded successfully!';
  });
});
