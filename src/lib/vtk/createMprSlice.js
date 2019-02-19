import { mat4, vec4 } from 'gl-matrix';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';

// Python Example: https://gitlab.kitware.com/vtk/vtk/blob/c13eb8658928b10db8c073b53081183b8ce60fd2/Examples/ImageProcessing/Cxx/ImageSlicing.cxx
// https://public.kitware.com/pipermail/vtkusers/2010-April/059673.html
export default function(vtkImageData, options = {}){
    options.plane = options.plane || 0;
    options.rotation = options.rotation || 0;
    options.sliceDelta = options.sliceDelta || 0;

    vtkImageData.setOrigin(0, 0, 0);

    const [x0, y0, z0] = vtkImageData.getOrigin();
    const [xSpacing, ySpacing, zSpacing] = vtkImageData.getSpacing();
    const [xMin, xMax, yMin, yMax, zMin, zMax] = vtkImageData.getExtent();

    // http://vtk.1045678.n5.nabble.com/vtkImageReslice-and-appending-slices-td5728537.html
    // https://public.kitware.com/pipermail/vtkusers/2012-January/071996.html
    // http://vtk.1045678.n5.nabble.com/vtkImageReslice-Rendering-slice-is-stretched-for-oblique-planes-if-no-OutputExtent-is-set-td5148691.html
    // However, when you use vtkImageReslice to do oblique 
    // slices, I recommend that you always set the OutputExtent, 
    // OutputSpacing, and OutputOrigin for vtkImageReslice. 
    // The code that vtkImageReslice uses to "guess" these 
    // values is really only useful for orthogonal reslicing. 
    // https://vtkusers.public.kitware.narkive.com/HgihE8by/adjusting-vtkimagereslice-extent-when-slicing-a-volume


    // SLICE SPACING/POSITION
    const centerOfVolume = []
    centerOfVolume[0] = x0 + xSpacing * 0.5 * (xMin + xMax); 
    centerOfVolume[1] = y0 + ySpacing * 0.5 * (yMin + yMax); 
    centerOfVolume[2] = z0 + zSpacing * 0.5 * (zMin + zMax);

    const sliceDelta = zSpacing * options.sliceDelta
    console.log('sliceDelta: ', sliceDelta)

    // Update "sliceIndex"
    // We'll need a more dynamic way to apply this for obliques/arbitrary rotation?
    // if(options.plane === 0){
    //     // Axial
    //     centerOfVolume[2] += sliceDelta;
    // }else if(options.plane === 1){
    //     // Coronal
    //     centerOfVolume[1] += sliceDelta;
    // }else{
    //     // Sagittal
    //     centerOfVolume[0] += sliceDelta;
    // }

    // These may all need to be changed if our axes change?
    centerOfVolume[0] += options.sliceDelta * xSpacing;
    centerOfVolume[1] += options.sliceDelta * ySpacing;
    centerOfVolume[2] += options.sliceDelta * zSpacing; // axial


    let axes = mat4.clone(_planeAxes[options.plane]);
    axes[12] = centerOfVolume[0]
    axes[13] = centerOfVolume[1]
    axes[14] = centerOfVolume[2]

    // const sliceCenterPoint = [
    //     0.0,
    //     0.0,
    //     zSpacing * options.sliceDelta,
    //     1.0
    // ]
    // let multiplied = [];
    // vec4.mul(multiplied, sliceCenterPoint, centerOfVolume);
    // console.log('multiplied', multiplied)


    const imageReslice = vtkImageReslice.newInstance();
    imageReslice.setInputData(vtkImageData);    // Our volume
    imageReslice.setOutputDimensionality(2);    // We want a "slice", not a volume
    imageReslice.setBackgroundColor(255, 255, 255, 255)

    //mat4.rotateX(axes, axes, options.rotation * Math.PI / 180);

    // https://public.kitware.com/pipermail/vtkusers/2008-September/048181.html
    // https://kitware.github.io/vtk-js/api/Common_Core_MatrixBuilder.html
    // setElement(int i, int j, double value)
    // https://vtk.org/doc/nightly/html/classvtkMatrix4x4.html#a6413522a56a1b78889db95a7427cb439
    // Axial
    // Set the point through which to slice
    // Similar to: https://vtk.org/doc/nightly/html/classvtkImageReslice.html#details
    // `setResliceAxesOrigin(x, y, z)`
    // the first three elements of the final column of the ResliceAxes matrix).


    console.log('AXES: ', axes)
    imageReslice.setResliceAxes(axes);

    const outputSlice = imageReslice.getOutputData();
    const spacing = outputSlice.getSpacing();

    console.log('OUTPUT SLICE: ', outputSlice)

    const result = {
        slice: outputSlice,
        metaData: {
            imagePlaneModule: {
                imagePositionPatient: [axes[12], axes[13], axes[14]],
                rowCosines: [axes[0], axes[1], axes[2]],
                columnCosines: [axes[4], axes[5], axes[6]],
                rowPixelSpacing: spacing[1],
                columnPixelSpacing: spacing[0],
                frameOfReferenceUID: "THIS-CAN-BE-ALMOST-ANYTHING"
            }
        }
    }

    console.log("~~~~~~ RESULT:", result)

    return result;
}

// What values correspond to:
// https://public.kitware.com/pipermail/vtkusers/2012-November/077297.html
// http://nipy.org/nibabel/dicom/dicom_orientation.html
// ux, uy, uz, 0
// vx, vy, vz, 0
// wx, wy, wz, 0
// px, py, pz, 1
//
// ux, uy, uz, vx, vy, vz is from the "ImageOrientationPatient"
// w = cross_product(u,v)
// px, py, pz is from "ImagePositionPatient"
//
// Example values:
//
// ImagePositionPatient: [60.3642578125, 170.3642578125, -32]
// ImageOrientationPatient: [-1, 0, 0, 0, -1, 0]
// RowCosines: [-1, 0, 0]
// ColumnCosines: [0, -1, 0]
const _planeAxes = [
    // Axial
    // 1, 0, 0, 0,
    // 0, 1, 0, 0,
    // 0, 0, 1, 0,
    // 0, 0, 0, 1   // 0, 1, slice
    mat4.create(),
    // Coronal
    mat4.fromValues(
        1, 0, 0, 0,
        0, 0, -1, 0,
        0, 1, 0, 0,
        0, 0, 0, 1), // 0, slice, 2
    // Sagittal
    mat4.fromValues(
        0, 1, 0, 0, 
        0, 0, -1, 0,
        -1, 0, 0, 0,
        0, 0, 0, 1), // slice, 1, 2 
    // Oblique
    mat4.fromValues(
        1, 0, 0, 0,
        0, 0.866025, 0.5, 0,
        0, -0.5, 0.866025, 0,
        0, 0, 0, 1) // 0, 1, 2
]

// https://public.kitware.com/pipermail/vtkusers/2013-January/078280.html
// the ResliceAxes matrix
// >defines a coordinate transformation that will be applied to the plane
// >Z=0 in order to generate an oblique plane that slices through your
// >input data.  A good way to think about it is that the 1st and 2nd
// >columns of the matrix are the basis vectors of the oblique plane, the
// >3rd column is the normal of the oblique plane, and the 4th column is
// >the "origin" of the oblique plane.  If you call SetOutputOrigin(0,0,0)
// >then the 4th column of the reslice matrix will precisely define the 3D
// >point at the corner of your oblique plane.

// r, r, r, r, // Basis vector      :: rotation
// r, r, r, r, // Basis vector      :: rotation
// r, r, r, r, // Normal of oblique :: rotation
// v, v, v, 1  // "origin" :: "translation" 

// r -> rotation
// v -> vector length