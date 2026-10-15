export const revalidations: { path: string; type: string | undefined }[] = [];

export const revalidatePath = (path: string, type?: string) => {
  revalidations.push({ path, type });
};

export const revalidateTag = () => undefined;
