import { describe, expect, it } from 'vitest';
import { resourceMetadataSchema, resourceMimeType, validateResourceFile, RESOURCE_MAX_BYTES } from './resource-validation';

const base={title:'Algorithms — Trees',category:'Notes',assignmentType:'',pageCount:''};

describe('resource metadata validation',()=>{
  it('accepts regular category metadata without assignment fields',()=>{
    expect(resourceMetadataSchema.safeParse(base).success).toBe(true);
    expect(resourceMetadataSchema.safeParse({...base,category:'Practical',assignmentType:''}).success).toBe(true);
  });
  it('requires Assignment 1, Assignment 2, or Other Assignment for assignment resources',()=>{
    expect(resourceMetadataSchema.safeParse({...base,category:'Assignment'}).success).toBe(false);
    expect(resourceMetadataSchema.safeParse({...base,category:'Assignment',assignmentType:'Assignment 1'}).success).toBe(true);
    expect(resourceMetadataSchema.safeParse({...base,category:'Assignment',assignmentType:'Assignment 2'}).success).toBe(true);
    expect(resourceMetadataSchema.safeParse({...base,category:'Assignment',assignmentType:'Other Assignment'}).success).toBe(true);
  });
  it('rejects assignment-specific values for non-assignment categories',()=>{
    expect(resourceMetadataSchema.safeParse({...base,category:'Notes',assignmentType:'Assignment 1'}).success).toBe(false);
  });
  it('requires a title but does not require branch, semester, or subject selectors',()=>{
    expect(resourceMetadataSchema.safeParse(base).success).toBe(true);
    expect(resourceMetadataSchema.safeParse({...base,title:'  '}).success).toBe(false);
  });
  it('accepts only positive whole-number page counts',()=>{
    expect(resourceMetadataSchema.safeParse({...base,pageCount:'24'}).success).toBe(true);
    expect(resourceMetadataSchema.safeParse({...base,pageCount:'0'}).success).toBe(false);
    expect(resourceMetadataSchema.safeParse({...base,pageCount:'2.5'}).success).toBe(false);
  });
  it('accepts only supported file names, MIME types, and sizes',()=>{
    expect(validateResourceFile({name:'lecture.pdf',type:'application/pdf',size:128})).toBeNull();
    expect(validateResourceFile({name:'archive.zip',type:'application/zip',size:1024})).toBeNull();
    expect(validateResourceFile({name:'mobile-upload.pdf',type:'application/octet-stream',size:128})).toBeNull();
    expect(resourceMimeType({name:'mobile-upload.pdf',type:'application/octet-stream'})).toBe('application/pdf');
    expect(validateResourceFile({name:'run.exe',type:'application/octet-stream',size:100})).toContain('not supported');
    expect(validateResourceFile({name:'too-large.pdf',type:'application/pdf',size:RESOURCE_MAX_BYTES+1})).toContain('50 MB');
    expect(validateResourceFile({name:'empty.pdf',type:'application/pdf',size:0})).toContain('empty files');
  });
});
