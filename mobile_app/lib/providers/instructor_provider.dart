import 'package:flutter/foundation.dart';

import '../models/training_group.dart';
import '../services/group_service.dart';

class InstructorProvider extends ChangeNotifier {
  InstructorProvider({GroupService? groupService})
    : _groupService = groupService ?? GroupService();

  final GroupService _groupService;

  List<TrainingGroup> groups = const [];
  TrainingGroup? selectedGroup;
  bool isLoading = false;
  String? errorMessage;

  Future<void> loadGroups({bool force = false}) async {
    if (isLoading || (groups.isNotEmpty && !force)) return;

    isLoading = true;
    errorMessage = null;
    notifyListeners();

    try {
      final loadedGroups = await _groupService.getMyGroups();
      groups = loadedGroups;
      if (selectedGroup != null &&
          !groups.any((group) => group.id == selectedGroup!.id)) {
        selectedGroup = null;
      }
    } catch (_) {
      errorMessage = 'No se pudieron cargar tus grupos. Revisa tu conexión e inténtalo de nuevo.';
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  void selectGroup(TrainingGroup? group) {
    selectedGroup = group;
    notifyListeners();
  }

  void clear() {
    groups = const [];
    selectedGroup = null;
    errorMessage = null;
    isLoading = false;
    notifyListeners();
  }
}
