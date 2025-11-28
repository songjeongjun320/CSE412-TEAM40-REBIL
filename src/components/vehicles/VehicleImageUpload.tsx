'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import React, { useCallback, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/supabaseClient';

interface VehicleImage {
    id?: string;
    image_url: string;
    image_type?: string;
    is_primary: boolean;
    display_order: number;
    file?: File;
}

interface VehicleImageUploadProps {
    vehicleId?: string;
    images: VehicleImage[];
    onImagesChange: (images: VehicleImage[]) => void;
    maxImages?: number;
    disabled?: boolean;
}

const IMAGE_TYPES = [
    { value: 'exterior_front', label: 'Front View' },
    { value: 'exterior_back', label: 'Back View' },
    { value: 'exterior_side', label: 'Side View' },
    { value: 'interior_front', label: 'Interior Front' },
    { value: 'interior_back', label: 'Interior Back' },
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'engine', label: 'Engine' },
    { value: 'trunk', label: 'Trunk/Boot' },
    { value: 'other', label: 'Other' },
];

const VehicleImageUpload = React.forwardRef<
    { uploadAllTemporaryImages: () => Promise<VehicleImage[]> },
    VehicleImageUploadProps
>(({ vehicleId, images, onImagesChange, maxImages = 10, disabled = false }, ref) => {
    const [uploading, setUploading] = useState<string[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadToSupabase = useCallback(async (file: File, vehicleId: string): Promise<string> => {
        const supabase = createClient();

        try {
            // First, check if the storage bucket exists
            console.log('Checking storage buckets...');
            const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

            if (bucketsError) {
                console.error('Error checking storage buckets:', bucketsError);
                throw new Error(`Failed to access storage: ${bucketsError.message}`);
            }

            console.log(
                'Available buckets:',
                buckets?.map((b) => ({ name: b.name, public: b.public })),
            );
            console.log('Total buckets found:', buckets?.length || 0);

            // Check if vehicle-images bucket exists
            const vehicleImagesBucket = buckets?.find((bucket) => bucket.name === 'vehicle-images');

            if (!vehicleImagesBucket) {
                console.error(
                    'vehicle-images bucket not found. Available buckets:',
                    buckets?.map((b) => b.name),
                );

                // Try to directly upload to see if it's a permissions issue
                console.log('Attempting direct upload to vehicle-images bucket...');
                const fileExt = file.name.split('.').pop();
                const fileName = `${vehicleId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

                const { data, error } = await supabase.storage
                    .from('vehicle-images')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (error) {
                    console.error('Direct upload error:', error);
                    throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
                }

                if (!data?.path) {
                    throw new Error('Upload succeeded but no path returned');
                }

                const { data: urlData } = supabase.storage
                    .from('vehicle-images')
                    .getPublicUrl(data.path);

                console.log('Direct upload successful, public URL:', urlData.publicUrl);
                return urlData.publicUrl;
            }

            console.log('Found vehicle-images bucket:', vehicleImagesBucket);

            const fileExt = file.name.split('.').pop();
            const fileName = `${vehicleId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

            console.log('Attempting to upload file:', fileName);

            const { data, error } = await supabase.storage
                .from('vehicle-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (error) {
                console.error('Upload error details:', {
                    message: error.message,
                    details: error,
                });
                throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
            }

            if (!data?.path) {
                throw new Error('Upload succeeded but no path returned');
            }

            const { data: urlData } = supabase.storage
                .from('vehicle-images')
                .getPublicUrl(data.path);

            console.log('Upload successful, public URL:', urlData.publicUrl);
            return urlData.publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }, []);

    // Function to upload all temporary images when submitting for approval
    const uploadAllTemporaryImages = useCallback(async (): Promise<VehicleImage[]> => {
        if (!vehicleId) {
            throw new Error('Vehicle ID is required for uploading images');
        }

        setIsUploading(true);
        setUploadError(null);

        try {
            const supabase = createClient();
            const uploadedImages: VehicleImage[] = [];
            const temporaryImages = images.filter((img) => img.file); // Only images with file objects
            const existingImages = images.filter((img) => !img.file && img.id); // Already uploaded images

            console.log(
                `Found ${temporaryImages.length} temporary images to upload and ${existingImages.length} existing images`,
            );

            // Add existing images first
            uploadedImages.push(...existingImages);

            if (temporaryImages.length === 0) {
                console.log('No temporary images to upload');
                return uploadedImages;
            }

            // Upload temporary images
            for (let i = 0; i < temporaryImages.length; i++) {
                const image = temporaryImages[i];
                if (!image.file) continue;

                try {
                    console.log(
                        `Uploading image ${i + 1}/${temporaryImages.length}:`,
                        image.file.name,
                    );
                    const uploadedUrl = await uploadToSupabase(image.file, vehicleId);

                    // Save to database
                    const { data: savedImage, error } = await supabase
                        .from('car_images')
                        .insert({
                            car_id: vehicleId,
                            image_url: uploadedUrl,
                            image_type: image.image_type,
                            is_primary: image.is_primary,
                            display_order: image.display_order,
                        })
                        .select()
                        .single();

                    if (error) {
                        console.error('Database save error:', error);
                        throw new Error(`Failed to save image to database: ${error.message}`);
                    }

                    // Create updated image object
                    const uploadedImage: VehicleImage = {
                        id: savedImage.id,
                        image_url: uploadedUrl,
                        image_type: image.image_type,
                        is_primary: image.is_primary,
                        display_order: image.display_order,
                    };

                    uploadedImages.push(uploadedImage);
                    console.log('Successfully uploaded and saved image:', savedImage.id);

                    // Clean up blob URL
                    if (image.image_url.startsWith('blob:')) {
                        URL.revokeObjectURL(image.image_url);
                    }
                } catch (error) {
                    console.error('Error uploading image:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    setUploadError(`Failed to upload image ${image.file.name}: ${errorMessage}`);
                    throw new Error(`Failed to upload image ${image.file.name}: ${errorMessage}`);
                }
            }

            console.log(
                `Successfully uploaded ${uploadedImages.length} total images (${temporaryImages.length} new, ${existingImages.length} existing)`,
            );
            return uploadedImages;
        } catch (error) {
            console.error('Upload process failed:', error);
            setUploadError(error instanceof Error ? error.message : 'Upload failed');
            throw error;
        } finally {
            setIsUploading(false);
        }
    }, [vehicleId, images, uploadToSupabase]);

    // Expose upload function to parent component
    React.useImperativeHandle(
        ref,
        () => ({
            uploadAllTemporaryImages,
        }),
        [uploadAllTemporaryImages],
    );

    const handleFileSelect = useCallback(
        async (files: FileList | null) => {
            console.log('handleFileSelect called with files:', files);

            if (!files || disabled || isUploading) {
                console.log('No files, disabled, or uploading:', {
                    files: !!files,
                    disabled,
                    isUploading,
                });
                return;
            }

            const fileArray = Array.from(files);
            console.log(
                'File array:',
                fileArray.map((f) => ({ name: f.name, type: f.type, size: f.size })),
            );

            const validFiles = fileArray.filter((file) => {
                const isImage = file.type.startsWith('image/');
                const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
                console.log('File validation:', {
                    name: file.name,
                    isImage,
                    isValidSize,
                    type: file.type,
                    size: file.size,
                });
                return isImage && isValidSize;
            });

            console.log('Valid files:', validFiles.length);

            if (validFiles.length === 0) {
                console.log('No valid files selected');
                return;
            }

            const remainingSlots = maxImages - images.length;
            const filesToProcess = validFiles.slice(0, remainingSlots);

            console.log(
                'Files to process:',
                filesToProcess.length,
                'remaining slots:',
                remainingSlots,
            );

            for (const file of filesToProcess) {
                const tempId = `temp-${Date.now()}-${Math.random()}`;
                const objectUrl = URL.createObjectURL(file);

                console.log('Created object URL for file:', file.name, objectUrl);

                const newImage: VehicleImage = {
                    image_url: objectUrl,
                    image_type: 'other',
                    is_primary: images.length === 0,
                    display_order: images.length,
                    file,
                };

                console.log('Created new image object:', newImage);

                setUploading((prev) => [...prev, tempId]);

                // Add to the images array as temporary (blob URL) for immediate display
                const updatedImages = [...images, newImage];
                console.log('Adding temporary image, array length:', updatedImages.length);
                onImagesChange(updatedImages);

                // Remove from uploading state since we're not uploading immediately
                setUploading((prev) => prev.filter((id) => id !== tempId));
            }
        },
        [images, maxImages, disabled, isUploading, onImagesChange],
    );

    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
        },
        [disabled],
    );

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            if (!disabled) {
                handleFileSelect(e.dataTransfer.files);
            }
        },
        [disabled, handleFileSelect],
    );

    const handleClick = useCallback(() => {
        if (!disabled && !isUploading && fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, [disabled, isUploading]);

    const removeImage = useCallback(
        async (index: number) => {
            const imageToRemove = images[index];

            // If it has an ID, it's saved in the database
            if (imageToRemove.id) {
                try {
                    const supabase = createClient();
                    await supabase.from('car_images').delete().eq('id', imageToRemove.id);
                } catch (error) {
                    console.error('Error deleting image from database:', error);
                    return; // Don't remove from UI if database deletion fails
                }
            }

            // Clean up object URL if it exists
            if (imageToRemove.image_url.startsWith('blob:')) {
                URL.revokeObjectURL(imageToRemove.image_url);
            }

            const newImages = images.filter((_, i) => i !== index);

            // Update display orders and ensure we have a primary image
            const updatedImages = newImages.map((img, i) => ({
                ...img,
                display_order: i,
                is_primary: i === 0 || (i === 0 && newImages.length > 0),
            }));

            onImagesChange(updatedImages);
        },
        [images, onImagesChange],
    );

    const setPrimary = useCallback(
        async (index: number) => {
            const updatedImages = images.map((img, i) => ({
                ...img,
                is_primary: i === index,
            }));

            // Update in database if image has ID
            if (vehicleId && images[index].id) {
                try {
                    const supabase = createClient();

                    // Remove primary from all images for this vehicle
                    await supabase
                        .from('car_images')
                        .update({ is_primary: false })
                        .eq('car_id', vehicleId);

                    // Set new primary
                    await supabase
                        .from('car_images')
                        .update({ is_primary: true })
                        .eq('id', images[index].id);
                } catch (error) {
                    console.error('Error updating primary image:', error);
                    return;
                }
            }

            onImagesChange(updatedImages);
        },
        [images, vehicleId, onImagesChange],
    );

    const updateImageType = useCallback(
        async (index: number, type: string) => {
            const updatedImages = [...images];
            updatedImages[index] = { ...updatedImages[index], image_type: type };

            // Update in database if image has ID
            if (vehicleId && updatedImages[index].id) {
                try {
                    const supabase = createClient();
                    await supabase
                        .from('car_images')
                        .update({ image_type: type })
                        .eq('id', updatedImages[index].id);
                } catch (error) {
                    console.error('Error updating image type:', error);
                    return;
                }
            }

            onImagesChange(updatedImages);
        },
        [images, vehicleId, onImagesChange],
    );

    return (
        <div className="space-y-6">
            {/* Upload Status */}
            {isUploading && (
                <div className="p-4 bg-blue-100 border border-blue-300 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="text-blue-800 font-medium">
                            Uploading images to storage...
                        </span>
                    </div>
                </div>
            )}

            {/* Upload Error */}
            {uploadError && (
                <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
                    <div className="flex items-start space-x-3">
                        <span className="text-red-600 text-lg">⚠️</span>
                        <div>
                            <p className="text-red-800 font-medium">Upload Error</p>
                            <p className="text-red-700 text-sm mt-1">{uploadError}</p>
                            <button
                                onClick={() => setUploadError(null)}
                                className="text-red-600 hover:text-red-800 text-sm mt-2 underline cursor-pointer"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Area */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
                className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-black bg-gray-50' : 'border-gray-400'}
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-black'}
        `}
            >
                {images.length === 0 ? (
                    <>
                        <div className="text-4xl mb-4">📷</div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {disabled ? 'Vehicle Photos (Read Only)' : 'Upload Vehicle Photos'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {disabled
                                ? 'Image editing is disabled while the vehicle is pending approval. You can view images but cannot make changes.'
                                : 'Drag and drop images here, or click to select files'}
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e.target.files)}
                            disabled={disabled || images.length >= maxImages || isUploading}
                            className="hidden"
                        />
                        <div
                            className={`
                inline-block px-6 py-2 rounded-lg transition-colors
                ${
                    disabled || images.length >= maxImages || isUploading
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        : 'bg-black text-white hover:bg-gray-800 cursor-pointer'
                }
              `}
                        >
                            {disabled ? 'Editing Disabled' : 'Choose Files'}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {disabled
                                ? 'Images cannot be modified during approval process'
                                : `Maximum ${maxImages} images, up to 10MB each. Supported formats: JPG, PNG, WebP. Select one image at a time.`}
                        </p>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">
                                Vehicle Photos ({images.length}/{maxImages})
                            </h3>
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={handleClick}
                                    className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors cursor-pointer"
                                >
                                    Add More
                                </button>
                            )}
                        </div>

                        {/* Image Grid inside upload area */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            <AnimatePresence>
                                {images.map((image, index) => (
                                    <motion.div
                                        key={image.id || image.image_url}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="relative group bg-white rounded-lg shadow-md overflow-hidden"
                                    >
                                        {/* Image */}
                                        <div className="aspect-video relative bg-gray-100">
                                            <Image
                                                src={image.image_url}
                                                alt={`Vehicle image ${index + 1}`}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            />

                                            {/* Primary Badge */}
                                            {image.is_primary && (
                                                <div className="absolute top-1 left-1 bg-green-500 text-white px-1 py-0.5 rounded text-xs font-medium">
                                                    Primary
                                                </div>
                                            )}

                                            {/* Image Type Badge */}
                                            {image.image_type && image.image_type !== 'other' && (
                                                <div className="absolute bottom-1 left-1 bg-blue-500 text-white px-1 py-0.5 rounded text-xs font-medium">
                                                    {IMAGE_TYPES.find(
                                                        (type) => type.value === image.image_type,
                                                    )?.label || image.image_type}
                                                </div>
                                            )}

                                            {/* Loading Overlay */}
                                            {uploading.includes(`temp-${index}`) && (
                                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                                </div>
                                            )}

                                            {/* Remove Button */}
                                            {!disabled && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeImage(index);
                                                    }}
                                                    className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>

                                        {/* Image Actions */}
                                        <div className="p-2 space-y-1">
                                            {!disabled && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPrimary(index);
                                                    }}
                                                    className={`w-full text-xs px-2 py-1 rounded ${
                                                        image.is_primary
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {image.is_primary ? 'Primary' : 'Set Primary'}
                                                </button>
                                            )}

                                            {/* Image Type Selector */}
                                            <select
                                                value={image.image_type || 'other'}
                                                onChange={(e) =>
                                                    updateImageType(index, e.target.value)
                                                }
                                                onClick={(e) => e.stopPropagation()}
                                                disabled={disabled}
                                                className={`w-full text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-black ${
                                                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                            >
                                                {IMAGE_TYPES.map((type) => (
                                                    <option key={type.value} value={type.value}>
                                                        {type.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e.target.files)}
                            disabled={disabled || images.length >= maxImages || isUploading}
                            className="hidden"
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

VehicleImageUpload.displayName = 'VehicleImageUpload';

export default VehicleImageUpload;
