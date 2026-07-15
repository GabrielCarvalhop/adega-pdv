import type { Product } from '@adega/shared';
import { ApiError, getToken } from './client';

export type UploadPurpose = 'product' | 'logo' | 'banner';

function fileToBase64(file: File): Promise<{ contentType: string; dataBase64: string }> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return Promise.reject(new Error('Use JPG, PNG ou WebP'));
  }
  if (file.size > 500_000) {
    return Promise.reject(new Error('Imagem muito grande — máximo 500 KB'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const dataBase64 = result.includes(',') ? result.split(',')[1]! : result;
      resolve({ contentType: file.type, dataBase64 });
    };
    reader.onerror = () => reject(new Error('Falha ao ler a imagem'));
    reader.readAsDataURL(file);
  });
}

async function upload(body: {
  purpose: UploadPurpose;
  productId?: number;
  contentType: string;
  dataBase64: string;
}): Promise<{ url: string; product?: Product }> {
  const token = getToken();
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error ?? 'Falha no upload', res.status);
  }
  return res.json();
}

export const uploadsApi = {
  uploadFile: async (purpose: UploadPurpose, file: File, productId?: number) => {
    const { contentType, dataBase64 } = await fileToBase64(file);
    return upload({ purpose, productId, contentType, dataBase64 });
  },
};
