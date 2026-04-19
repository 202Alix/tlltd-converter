import React from 'react';
import { Upload } from 'lucide-react';
import { loadImage } from '../lib/imageProcessor';

interface ImageUploadProps {
  onImageLoaded: (imageData: ImageData, originalSize: { width: number; height: number }) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageLoaded }) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { imageData, originalSize } = await loadImage(file);
      onImageLoaded(imageData, originalSize);
    } catch (error) {
      console.error('Error loading image:', error);
      alert('Error loading image. Please try another file.');
    }
  };

  return (
    <div
      className="rounded-3xl p-12 text-center cursor-pointer transition-all"
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="imageInput"
      />
      <label
        htmlFor="imageInput"
        className="cursor-pointer inline-block"
      >
        <div className="inline-block p-6 rounded-full mb-6" style={{ backgroundColor: '#FF8000' }}>
          <Upload className="w-12 h-12 text-white" strokeWidth={3} />
        </div>
        <p className="text-2xl font-black text-primary mb-3">Drag & Drop Your Image Here!</p>
        <p className="text-lg text-muted-foreground">or click to browse</p>
      </label>
    </div>
  );
};
