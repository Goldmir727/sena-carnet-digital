import 'package:flutter/material.dart';

import '../core/constants/api_constants.dart';
import '../services/auth_service.dart';

class AuthenticatedProfilePhoto extends StatefulWidget {
  const AuthenticatedProfilePhoto({
    super.key,
    required this.userId,
    required this.hasPhoto,
    required this.radius,
    required this.placeholder,
    required this.backgroundColor,
  });

  final int userId;
  final bool hasPhoto;
  final double radius;
  final Widget placeholder;
  final Color backgroundColor;

  @override
  State<AuthenticatedProfilePhoto> createState() =>
      _AuthenticatedProfilePhotoState();
}

class _AuthenticatedProfilePhotoState extends State<AuthenticatedProfilePhoto> {
  late Future<String?> _tokenFuture;

  @override
  void initState() {
    super.initState();
    _loadToken();
  }

  @override
  void didUpdateWidget(covariant AuthenticatedProfilePhoto oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.userId != widget.userId ||
        oldWidget.hasPhoto != widget.hasPhoto) {
      _loadToken();
    }
  }

  void _loadToken() {
    _tokenFuture = widget.hasPhoto
        ? AuthService().getToken()
        : Future<String?>.value(null);
  }

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: widget.radius,
      backgroundColor: widget.backgroundColor,
      child: widget.hasPhoto
          ? FutureBuilder<String?>(
              future: _tokenFuture,
              builder: (context, snapshot) {
                final token = snapshot.data;
                if (token == null || token.isEmpty) return widget.placeholder;

                return ClipOval(
                  child: SizedBox.square(
                    dimension: widget.radius * 2,
                    child: Image.network(
                      ApiConstants.profilePhotoUrl(widget.userId),
                      headers: {'Authorization': 'Bearer $token'},
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) =>
                          widget.placeholder,
                    ),
                  ),
                );
              },
            )
          : widget.placeholder,
    );
  }
}
