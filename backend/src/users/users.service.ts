import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateUserDto, UpdateSocioDto, CreateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('usuarios')
      .select('*, socios(*)')
      .order('nombre');

    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('usuarios')
      .select('*, socios(*)')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Usuario no encontrado');
    return data;
  }

  async search(query: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('usuarios')
      .select('*, socios(*)')
      .or(`nombre.ilike.%${query}%,dni.ilike.%${query}%,telefono.ilike.%${query}%,email.ilike.%${query}%`)
      .order('nombre')
      .limit(20);

    if (error) throw error;
    return data;
  }

  async create(createUserDto: CreateUserDto) {
    const client = this.supabaseService.getClient();

    // Create user in Supabase Auth (trigger will create usuarios row)
    const { data: authData, error: authError } =
      await client.auth.admin.createUser({
        email: createUserDto.email,
        password: createUserDto.password,
        email_confirm: true,
        user_metadata: {
          nombre: createUserDto.nombre,
          rol: createUserDto.rol || 'socio',
        },
      });

    if (authError) {
      if (authError.message.includes('already')) {
        throw new ConflictException('El email ya está registrado');
      }
      throw authError;
    }

    // Update additional fields
    if (createUserDto.dni || createUserDto.telefono) {
      await client
        .from('usuarios')
        .update({
          dni: createUserDto.dni,
          telefono: createUserDto.telefono,
          rol: createUserDto.rol || 'socio',
        })
        .eq('id', authData.user.id);
    }

    // If socio, create socios row
    if ((createUserDto.rol || 'socio') === 'socio') {
      await client.from('socios').insert({
        id_usuario: authData.user.id,
        activo: true,
      });
    }

    return this.findOne(authData.user.id);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const client = this.supabaseService.getClient();

    // Verify user exists
    await this.findOne(id);

    const { data, error } = await client
      .from('usuarios')
      .update({
        ...updateUserDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, socios(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async updateSocio(userId: string, updateSocioDto: UpdateSocioDto) {
    const client = this.supabaseService.getClient();

    const { data: existing } = await client
      .from('socios')
      .select('*')
      .eq('id_usuario', userId)
      .single();

    if (!existing) {
      // Create socio record if it doesn't exist
      const { data, error } = await client
        .from('socios')
        .insert({
          id_usuario: userId,
          ...updateSocioDto,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from('socios')
      .update({
        ...updateSocioDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id_usuario', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async remove(id: string) {
    const client = this.supabaseService.getClient();

    // Soft delete: set estado to inactivo
    const { error } = await client
      .from('usuarios')
      .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return { message: 'Usuario desactivado' };
  }
}
