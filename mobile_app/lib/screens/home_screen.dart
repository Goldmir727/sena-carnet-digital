import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/instructor_provider.dart';
import 'attendance_screen.dart';
import 'access_history_screen.dart';
import 'carnet_screen.dart';
import 'events_screen.dart';
import 'instructor_page.dart';
import 'login_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  // Diálogo de confirmación para cerrar sesión
  Future<void> _showLogoutDialog(
    BuildContext context,
    AuthProvider authProvider,
  ) async {
    final navigator = Navigator.of(context);
    final instructorProvider = context.read<InstructorProvider>();

    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text(
          '¿Estás seguro de que deseas salir de la aplicación?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );

    if (shouldLogout == true) {
      await authProvider.logout();
      if (!mounted) return;
      instructorProvider.clear();
      if (!navigator.mounted) return;
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.user;
    final screens = <Widget>[const CarnetScreen()];
    final destinations = <NavigationDestination>[
      const NavigationDestination(
        icon: Icon(Icons.badge_outlined, color: Color(0xFF17212B)),
        selectedIcon: Icon(Icons.badge, color: Color(0xFF0F7A4D)),
        label: 'Carnet',
      ),
    ];

    screens.add(const AttendanceScreen(embedded: true));
    destinations.add(
      const NavigationDestination(
        icon: Icon(Icons.qr_code_scanner_outlined, color: Color(0xFF17212B)),
        selectedIcon: Icon(Icons.qr_code_scanner, color: Color(0xFF0F7A4D)),
        label: 'Asistencia',
      ),
    );

    if (user?.role == 'Coordinador') {
      screens.add(const EventsScreen(embedded: true));
      destinations.add(
        const NavigationDestination(
          icon: Icon(Icons.event_outlined, color: Color(0xFF17212B)),
          selectedIcon: Icon(Icons.event, color: Color(0xFF0F7A4D)),
          label: 'Eventos',
        ),
      );
    }

    if (user?.role == 'Docente') {
      screens.add(const InstructorPage(embedded: true));
      destinations.add(
        const NavigationDestination(
          icon: Icon(Icons.school_outlined, color: Color(0xFF17212B)),
          selectedIcon: Icon(Icons.school, color: Color(0xFF0F7A4D)),
          label: 'Docencia',
        ),
      );
    }

    screens.addAll(const [
      ProfileScreen(),
      AccessHistoryScreen(embedded: true),
    ]);
    destinations.addAll(const [
      NavigationDestination(
        icon: Icon(Icons.person_outline, color: Color(0xFF17212B)),
        selectedIcon: Icon(Icons.person, color: Color(0xFF0F7A4D)),
        label: 'Perfil',
      ),
      NavigationDestination(
        icon: Icon(Icons.history_outlined, color: Color(0xFF17212B)),
        selectedIcon: Icon(Icons.history, color: Color(0xFF0F7A4D)),
        label: 'Historial',
      ),
    ]);
    final selectedIndex = _selectedIndex.clamp(0, screens.length - 1).toInt();

    return Scaffold(
      backgroundColor: const Color(0xFFF3F6F4),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFF0A5A39),
        foregroundColor: Colors.white,
        titleSpacing: 16,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFF0F7A4D), // Verde SENA
              child: Text(
                (user?.fullName.isNotEmpty == true)
                    ? user!.fullName[0].toUpperCase()
                    : 'S',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?.fullName ?? 'SENA Digital',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    user?.role ?? 'SENA Digital',
                    style: TextStyle(fontSize: 12, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => _showLogoutDialog(context, authProvider),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        child: screens[selectedIndex],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF17212B).withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: NavigationBar(
          elevation: 0,
          backgroundColor: Colors.white,
          indicatorColor: const Color(0xFFE8F5EE),
          selectedIndex: selectedIndex,
          onDestinationSelected: (index) {
            setState(() {
              _selectedIndex = index;
            });
          },
          destinations: destinations,
        ),
      ),
    );
  }
}
