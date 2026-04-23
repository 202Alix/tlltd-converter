import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { loadImage } from '../lib/imageProcessor';

interface ImageUploadProps {
  onImageLoaded: (imageData: ImageData, originalSize: { width: number; height: number }) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageLoaded }) => {
  const [isDragOver, setIsDragOver] = useState(false);

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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const input = document.getElementById('imageInput') as HTMLInputElement;
        if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
          handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>);
        }
      } else {
        alert('Please drop an image file.');
      }
    }
  };

  return (
    <div
      className="rounded-3xl p-12 text-center cursor-pointer transition-all"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: isDragOver ? '3px dashed #FF8000' : 'none',
      }}
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
        <p className="text-2xl font-black text-primary">Drag & Drop Your Image Here!</p>
        <p className="text-lg text-muted-foreground mb-6">or click to browse</p>
        
        {/* File format and size information */}
        <div className="text-sm text-muted-foreground space-y-1 mt-8">
          <p>Recommended formats: PNG, JPG, WebP</p>
        </div>
      </label>
    </div>
  );
};
