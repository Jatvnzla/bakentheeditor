# Implementación de Actualización de Fragmentos de Video

## Descripción General

Este documento describe la implementación de la funcionalidad para actualizar fragmentos de video en Firebase desde la API de transformación. La funcionalidad permite que, cuando un video es transformado por la API, los fragmentos generados sean registrados automáticamente en Firebase con toda la información necesaria.

## Componentes Principales

### 1. Servicio de Estado de Transformación (`transformStatusService.ts`)

Este servicio se encarga de:
- Consultar el estado de transformación de un video a la API
- Actualizar el estado del video en Firebase
- Registrar los fragmentos generados cuando la transformación se completa

La función clave es `registerVideoFragments`, que:
- Verifica si ya existen fragmentos para el video
- Extrae información de segmentos de la respuesta de la API
- Crea documentos en Firebase para cada fragmento con toda la información necesaria
- Maneja casos donde no hay información de segmentos disponible

### 2. Componente de Visualización de Fragmentos (`VideoFragments.tsx`)

Este componente permite:
- Visualizar los fragmentos asociados a un video original
- Mostrar información detallada de cada fragmento (duración, tiempos, etc.)
- Proporcionar herramientas de prueba para registrar y limpiar fragmentos

### 3. Integración en la Interfaz de Usuario (`VideoList.tsx`)

La integración en la interfaz de usuario incluye:
- Un botón "Ver Fragmentos" en el menú de opciones de cada video original
- Un modal que muestra los fragmentos asociados al video seleccionado
- Información básica del video original en el modal de fragmentos

### 4. Herramientas de Prueba

Se han creado varias herramientas para probar la funcionalidad:
- `testFragmentRegistration.ts`: Permite simular la respuesta de la API y registrar fragmentos
- `testFragmentFlow.ts`: Script para probar el flujo completo desde un video existente

## Flujo de Trabajo

1. **Subida de Video Original**:
   - El usuario sube un video a MinIO
   - El video se registra en Firebase con estado "pending"
   - Se añaden metadatos (título, descripción)

2. **Transformación del Video**:
   - El usuario inicia la transformación del video
   - El estado del video se actualiza a "processing"
   - Se inicia el polling para verificar el estado de transformación

3. **Actualización de Estado y Fragmentos**:
   - Cuando la transformación se completa, el estado del video se actualiza a "completed"
   - Si hay información de segmentos, se registran los fragmentos en Firebase
   - Cada fragmento tiene su propio documento con tipo "fragment" y parentId apuntando al video original

4. **Visualización de Fragmentos**:
   - El usuario puede ver los fragmentos asociados a un video original
   - Puede reproducir cada fragmento individualmente
   - Puede seleccionar un fragmento para operaciones adicionales

## Estructura de Datos

### Video Original
```typescript
{
  id: string,
  title: string,
  description: string,
  minioUrl: string,
  thumbnailUrl?: string,
  duration?: number,
  type: 'original',
  status: 'pending' | 'processing' | 'completed' | 'error',
  createdAt: timestamp,
  updatedAt: timestamp,
  userId: string,
  metadata: {
    job_id?: string,
    transformStatus?: {
      segments: Array<{
        segment_number: number,
        start_time: number,
        end_time: number,
        duration: number,
        duration_minutes: number
      }>
    }
  }
}
```

### Fragmento de Video
```typescript
{
  id: string,
  title: string,
  description: string,
  minioUrl: string,
  thumbnailUrl?: string,
  duration?: number,
  type: 'fragment',
  parentId: string, // ID del video original
  status: 'completed',
  createdAt: timestamp,
  updatedAt: timestamp,
  userId: string,
  metadata: {
    job_id: string,
    segment_number: number,
    start_time?: number,
    end_time?: number,
    transformCompleted: boolean
  }
}
```

## Consideraciones Adicionales

- **Manejo de Errores**: Se implementaron verificaciones para evitar duplicados y manejar casos donde la información de segmentos no está disponible.
- **Rendimiento**: La creación de fragmentos se realiza en paralelo utilizando `Promise.all` para mejorar el rendimiento.
- **Interfaz de Usuario**: Se diseñó una interfaz intuitiva para visualizar y gestionar fragmentos.
- **Pruebas**: Se crearon herramientas específicas para probar la funcionalidad sin depender de la API externa.

## Próximos Pasos

- Implementar miniaturas específicas para cada fragmento
- Añadir funcionalidad para editar metadatos de fragmentos
- Mejorar la visualización de fragmentos con vista previa
- Implementar funcionalidad para programar publicaciones de fragmentos específicos
