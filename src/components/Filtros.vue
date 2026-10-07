<script setup lang="ts">
import { fmtInt } from "../lib/format";
import type { Categoria, Filtros } from "../lib/queries";

const filtros = defineModel<Filtros>({ required: true });
defineProps<{ categorias: Categoria[] }>();
</script>

<template>
  <div class="filtros">
    <label>
      Categoria
      <select v-model="filtros.categoria" class="field">
        <option value="">Todas</option>
        <!-- categorias sem produto ativo só aparecem com "incluir inativos" -->
        <template v-for="c in categorias" :key="c.nome">
          <option v-if="filtros.inativos || c.ativos > 0 || c.nome === filtros.categoria" :value="c.nome">
            {{ c.nome }} ({{ fmtInt(filtros.inativos ? c.total : c.ativos) }})
          </option>
        </template>
      </select>
    </label>
    <label>
      Tipo
      <select v-model="filtros.tipo" class="field">
        <option value="">Todos</option>
        <option value="Notificado">Notificado</option>
        <option value="Registrado">Registrado</option>
      </select>
    </label>
    <label><input v-model="filtros.inativos" type="checkbox" /> Incluir inativos</label>
  </div>
</template>
